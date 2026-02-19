import type { APIRoute } from "astro"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const PUT: APIRoute = async ({ locals, request, url }) => {
  const { env } = locals.runtime

  const fileId = url.searchParams.get("fileId")
  const partNumber = Number.parseInt(url.searchParams.get("partNumber") || "0", 10)

  if (!fileId || !partNumber) {
    return json({ error: "fileId and partNumber required" }, 400)
  }

  try {
    const multipartData = await env.KV.get(`multipart:${fileId}`)
    if (!multipartData) {
      return json({ error: "Multipart upload not found" }, 404)
    }

    const parsed = JSON.parse(multipartData)
    const { uploadId, objectKey, parts } = parsed

    const multipart = env.R2.resumeMultipartUpload(objectKey, uploadId)
    const part = await multipart.uploadPart(partNumber, request.body as ReadableStream)

    parts.push({ partNumber, etag: part.etag })
    await env.KV.put(`multipart:${fileId}`, JSON.stringify({ ...parsed, parts }), {
      expirationTtl: 60 * 60 * 24,
    })

    return json({ partNumber, etag: part.etag })
  } catch (err) {
    console.error("Part upload failed:", err)
    return json({ error: "Part upload failed" }, 500)
  }
}

export const ALL: APIRoute = () => json({ error: "Method not allowed" }, 405)
