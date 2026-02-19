import type { APIRoute } from "astro"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const POST: APIRoute = async ({ locals, request }) => {
  const { env } = locals.runtime

  const body = await request.json()
  const { fileId } = body

  if (!fileId) {
    return json({ error: "fileId required" }, 400)
  }

  try {
    const multipartData = await env.KV.get(`multipart:${fileId}`)
    if (!multipartData) {
      return json({ error: "Multipart upload not found" }, 404)
    }

    const { uploadId, objectKey, parts, fileName, contentType } = JSON.parse(multipartData)

    const sortedParts = parts.sort(
      (a: { partNumber: number }, b: { partNumber: number }) => a.partNumber - b.partNumber,
    )

    const multipart = env.R2.resumeMultipartUpload(objectKey, uploadId)
    const object = await multipart.complete(sortedParts)

    await env.DB.prepare(
      "INSERT INTO uploads (id, file_name, file_size, object_key, content_type, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        fileId,
        fileName,
        object.size,
        objectKey,
        contentType || "application/octet-stream",
        request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for"),
        request.headers.get("user-agent"),
      )
      .run()

    await env.KV.delete(`multipart:${fileId}`)

    return json({ fileId, fileName, size: object.size, objectKey })
  } catch (err) {
    console.error("Complete multipart failed:", err)
    return json({ error: "Failed to complete upload" }, 500)
  }
}

export const ALL: APIRoute = () => json({ error: "Method not allowed" }, 405)
