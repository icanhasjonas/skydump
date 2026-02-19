import type { APIRoute } from "astro"

// POST /api/upload/complete - finalize multipart upload
export const POST: APIRoute = async ({ locals, request }) => {
  const { env } = locals.runtime

  const body = await request.json()
  const { fileId } = body

  if (!fileId) {
    return new Response(JSON.stringify({ error: "fileId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const multipartData = await env.KV.get(`multipart:${fileId}`)
    if (!multipartData) {
      return new Response(JSON.stringify({ error: "Multipart upload not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { uploadId, objectKey, parts, fileName } = JSON.parse(multipartData)

    // Sort parts by part number before completing
    const sortedParts = parts.sort(
      (a: { partNumber: number }, b: { partNumber: number }) => a.partNumber - b.partNumber,
    )

    const multipart = env.R2.resumeMultipartUpload(objectKey, uploadId)
    const object = await multipart.complete(sortedParts)

    // Store final metadata in KV
    await env.KV.put(
      `upload:${fileId}`,
      JSON.stringify({
        fileId,
        objectKey,
        fileName,
        size: object.size,
        uploadedAt: new Date().toISOString(),
      }),
      { expirationTtl: 60 * 60 * 24 * 365 },
    )

    // Clean up multipart KV entry
    await env.KV.delete(`multipart:${fileId}`)

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
    console.error("Complete multipart failed:", err)
    return new Response(JSON.stringify({ error: "Failed to complete upload" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
