import type { APIRoute } from "astro"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const POST: APIRoute = async ({ locals, request }) => {
  const { env } = locals.runtime

  const body = await request.json()
  const { fileName, contentType } = body

  if (!fileName) {
    return json({ error: "fileName required" }, 400)
  }

  const fileId = crypto.randomUUID()
  const objectKey = `${fileId}/${fileName}`
  const ct = contentType || "application/octet-stream"

  try {
    const multipart = await env.R2.createMultipartUpload(objectKey, {
      httpMetadata: { contentType: ct },
      customMetadata: { originalName: fileName },
    })

    await env.KV.put(
      `multipart:${fileId}`,
      JSON.stringify({
        uploadId: multipart.uploadId,
        objectKey,
        fileName,
        contentType: ct,
        parts: [],
      }),
      { expirationTtl: 60 * 60 * 24 },
    )

    return json({ fileId, uploadId: multipart.uploadId, objectKey })
  } catch (err) {
    console.error("Multipart init failed:", err)
    return json({ error: "Failed to init multipart upload" }, 500)
  }
}

export const ALL: APIRoute = () => json({ error: "Method not allowed" }, 405)
