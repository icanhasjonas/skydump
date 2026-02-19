import type { APIRoute } from "astro"

// POST /api/upload/multipart - initiate multipart upload
export const POST: APIRoute = async ({ locals, request }) => {
  const { env } = locals.runtime

  const body = await request.json()
  const { fileName, contentType } = body

  if (!fileName) {
    return new Response(JSON.stringify({ error: "fileName required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const fileId = crypto.randomUUID()
  const objectKey = `${fileId}/${fileName}`

  try {
    const multipart = await env.R2.createMultipartUpload(objectKey, {
      httpMetadata: { contentType: contentType || "application/octet-stream" },
      customMetadata: {
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
      },
    })

    // Store multipart info in KV for subsequent part uploads
    await env.KV.put(
      `multipart:${fileId}`,
      JSON.stringify({
        uploadId: multipart.uploadId,
        objectKey,
        fileName,
        parts: [],
      }),
      { expirationTtl: 60 * 60 * 24 }, // 24h to complete upload
    )

    return new Response(
      JSON.stringify({
        fileId,
        uploadId: multipart.uploadId,
        objectKey,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (err) {
    console.error("Multipart init failed:", err)
    return new Response(JSON.stringify({ error: "Failed to init multipart upload" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
