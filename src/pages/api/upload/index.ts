import type { APIRoute } from "astro"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const POST: APIRoute = async ({ locals, request }) => {
  const { env } = locals.runtime

  const fileName = request.headers.get("x-file-name")
  const contentType = request.headers.get("content-type") || "application/octet-stream"

  if (!fileName) {
    return json({ error: "x-file-name header required" }, 400)
  }

  const fileId = crypto.randomUUID()
  const objectKey = `${fileId}/${fileName}`

  try {
    const object = await env.R2.put(objectKey, request.body, {
      httpMetadata: { contentType },
      customMetadata: { originalName: fileName },
    })

    await env.DB.prepare(
      "INSERT INTO uploads (id, file_name, file_size, object_key, content_type, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        fileId,
        fileName,
        object.size,
        objectKey,
        contentType,
        request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for"),
        request.headers.get("user-agent"),
      )
      .run()

    return json({ fileId, fileName, size: object.size, objectKey })
  } catch (err) {
    console.error("Upload failed:", err)
    return json({ error: "Upload failed" }, 500)
  }
}

export const ALL: APIRoute = () => json({ error: "Method not allowed" }, 405)
