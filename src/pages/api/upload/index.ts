import type { APIRoute } from "astro"

// Direct upload - streams request body to R2
// For files up to ~100MB this is the simplest path
export const POST: APIRoute = async ({ locals, request }) => {
  const { env } = locals.runtime

  const fileName = request.headers.get("x-file-name")
  const contentType = request.headers.get("content-type") || "application/octet-stream"

  if (!fileName) {
    return new Response(JSON.stringify({ error: "x-file-name header required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const fileId = crypto.randomUUID()
  const objectKey = `${fileId}/${fileName}`

  try {
    const object = await env.R2.put(objectKey, request.body, {
      httpMetadata: { contentType },
      customMetadata: {
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
      },
    })

    // Store metadata in KV for listing
    await env.KV.put(
      `upload:${fileId}`,
      JSON.stringify({
        fileId,
        objectKey,
        fileName,
        size: object.size,
        uploadedAt: new Date().toISOString(),
      }),
      { expirationTtl: 60 * 60 * 24 * 365 }, // 1 year
    )

    return new Response(
      JSON.stringify({
        fileId,
        fileName,
        size: object.size,
        objectKey,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (err) {
    console.error("Upload failed:", err)
    return new Response(JSON.stringify({ error: "Upload failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
