import { AwsClient } from "aws4fetch"
import { Hono } from "hono"
import { type Bindings, R2_BUCKET, R2_S3_ENDPOINT } from "../types"

const app = new Hono<{ Bindings: Bindings }>()

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function s3Client(env: Bindings) {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  })
}

function s3Url(objectKey: string) {
  return `${R2_S3_ENDPOINT}/${R2_BUCKET}/${objectKey}`
}

// POST /api/upload/presign - get a presigned PUT URL for direct-to-R2 upload
app.post("/presign", async (c) => {
  const body = await c.req.json()
  const { fileName, contentType } = body

  if (!fileName) {
    return json({ error: "fileName required" }, 400)
  }

  const fileId = crypto.randomUUID()
  const objectKey = `${fileId}/${fileName}`
  const ct = contentType || "application/octet-stream"

  const aws = s3Client(c.env)
  const url = new URL(s3Url(objectKey))
  url.searchParams.set("X-Amz-Expires", "3600")

  const signed = await aws.sign(
    new Request(url, {
      method: "PUT",
      headers: { "Content-Type": ct },
    }),
    { aws: { signQuery: true } },
  )

  return json({ fileId, objectKey, uploadUrl: signed.url })
})

// POST /api/upload/confirm - confirm direct upload, record in D1
app.post("/confirm", async (c) => {
  const request = c.req.raw
  const body = await c.req.json()
  const { fileId, fileName, fileSize, contentType, objectKey } = body

  if (!fileId || !fileName || !objectKey) {
    return json({ error: "fileId, fileName, objectKey required" }, 400)
  }

  try {
    await c.env.DB.prepare(
      "INSERT INTO uploads (id, file_name, file_size, object_key, content_type, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        fileId,
        fileName,
        fileSize || 0,
        objectKey,
        contentType || "application/octet-stream",
        request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for"),
        request.headers.get("user-agent"),
      )
      .run()

    return json({ fileId, fileName, size: fileSize, objectKey })
  } catch (err) {
    console.error("Confirm failed:", err)
    return json({ error: "Failed to confirm upload" }, 500)
  }
})

// POST /api/upload/multipart - init multipart, return presigned URLs for all parts
app.post("/multipart", async (c) => {
  const body = await c.req.json()
  const { fileName, contentType, fileSize } = body

  if (!fileName || !fileSize) {
    return json({ error: "fileName and fileSize required" }, 400)
  }

  const fileId = crypto.randomUUID()
  const objectKey = `${fileId}/${fileName}`
  const ct = contentType || "application/octet-stream"
  const aws = s3Client(c.env)

  try {
    // Create multipart upload via S3 API
    const initUrl = new URL(s3Url(objectKey))
    initUrl.searchParams.set("uploads", "")

    const initRes = await aws.fetch(initUrl, {
      method: "POST",
      headers: { "Content-Type": ct },
    })

    if (!initRes.ok) {
      const errText = await initRes.text()
      console.error("S3 CreateMultipartUpload failed:", errText)
      throw new Error("Failed to init multipart")
    }

    const xml = await initRes.text()
    const uploadIdMatch = xml.match(/<UploadId>(.+?)<\/UploadId>/)
    if (!uploadIdMatch) throw new Error("No UploadId in response")
    const uploadId = uploadIdMatch[1]

    // Generate presigned URLs for each part
    const chunkSize = 50 * 1024 * 1024
    const totalParts = Math.ceil(fileSize / chunkSize)
    const parts: { partNumber: number; url: string }[] = []

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const partUrl = new URL(s3Url(objectKey))
      partUrl.searchParams.set("partNumber", String(partNumber))
      partUrl.searchParams.set("uploadId", uploadId)
      partUrl.searchParams.set("X-Amz-Expires", "3600")

      const signed = await aws.sign(new Request(partUrl, { method: "PUT" }), {
        aws: { signQuery: true },
      })

      parts.push({ partNumber, url: signed.url })
    }

    // Store session in KV for the complete step
    await c.env.KV.put(
      `multipart:${fileId}`,
      JSON.stringify({ uploadId, objectKey, fileName, contentType: ct }),
      { expirationTtl: 60 * 60 * 24 },
    )

    return json({ fileId, uploadId, objectKey, parts })
  } catch (err) {
    console.error("Multipart init failed:", err)
    return json({ error: "Failed to init multipart upload" }, 500)
  }
})

// POST /api/upload/complete - finalize multipart (server fetches ETags via S3 ListParts)
app.post("/complete", async (c) => {
  const request = c.req.raw
  const body = await c.req.json()
  const { fileId } = body as { fileId: string }

  if (!fileId) {
    return json({ error: "fileId required" }, 400)
  }

  try {
    const multipartData = await c.env.KV.get(`multipart:${fileId}`)
    if (!multipartData) {
      return json({ error: "Multipart upload not found" }, 404)
    }

    const { uploadId, objectKey, fileName, contentType } = JSON.parse(multipartData)
    const aws = s3Client(c.env)

    // List uploaded parts to get ETags (browser can't read them due to CORS)
    const listUrl = new URL(s3Url(objectKey))
    listUrl.searchParams.set("uploadId", uploadId)

    const listRes = await aws.fetch(listUrl, { method: "GET" })
    if (!listRes.ok) {
      const errText = await listRes.text()
      console.error("S3 ListParts failed:", errText)
      throw new Error("Failed to list parts")
    }

    const listXml = await listRes.text()
    const partMatches = [
      ...listXml.matchAll(
        /<Part>\s*<PartNumber>(\d+)<\/PartNumber>\s*.*?<ETag>(.+?)<\/ETag>\s*.*?<\/Part>/gs,
      ),
    ]
    if (partMatches.length === 0) throw new Error("No parts found")

    const parts = partMatches
      .map((m) => ({ partNumber: Number(m[1]), etag: m[2] }))
      .sort((a, b) => a.partNumber - b.partNumber)

    // Complete multipart via S3 API
    const completeXml = [
      "<CompleteMultipartUpload>",
      ...parts.map(
        (p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`,
      ),
      "</CompleteMultipartUpload>",
    ].join("")

    const completeUrl = new URL(s3Url(objectKey))
    completeUrl.searchParams.set("uploadId", uploadId)

    const completeRes = await aws.fetch(completeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: completeXml,
    })

    if (!completeRes.ok) {
      const errText = await completeRes.text()
      console.error("S3 CompleteMultipartUpload failed:", errText)
      throw new Error("Failed to complete multipart")
    }

    // Get final object size from R2
    const object = await c.env.R2.head(objectKey)
    const fileSize = object?.size || 0

    await c.env.DB.prepare(
      "INSERT INTO uploads (id, file_name, file_size, object_key, content_type, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        fileId,
        fileName,
        fileSize,
        objectKey,
        contentType || "application/octet-stream",
        request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for"),
        request.headers.get("user-agent"),
      )
      .run()

    await c.env.KV.delete(`multipart:${fileId}`)

    return json({ fileId, fileName, size: fileSize, objectKey })
  } catch (err) {
    console.error("Complete multipart failed:", err)
    return json({ error: "Failed to complete upload" }, 500)
  }
})

// Catch-all for unsupported methods
app.all("/*", () => json({ error: "Method not allowed" }, 405))

export default app
