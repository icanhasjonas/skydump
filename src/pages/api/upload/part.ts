import type { APIRoute } from "astro"

// PUT /api/upload/part?fileId=xxx&partNumber=N - upload a single part
export const PUT: APIRoute = async ({ locals, request, url }) => {
  const { env } = locals.runtime

  const fileId = url.searchParams.get("fileId")
  const partNumber = Number.parseInt(url.searchParams.get("partNumber") || "0", 10)

  if (!fileId || !partNumber) {
    return new Response(JSON.stringify({ error: "fileId and partNumber required" }), {
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

    const { uploadId, objectKey, parts } = JSON.parse(multipartData)

    // Resume the multipart upload and upload this part
    const multipart = env.R2.resumeMultipartUpload(objectKey, uploadId)
    const part = await multipart.uploadPart(partNumber, request.body as ReadableStream)

    // Update parts list in KV
    parts.push({ partNumber, etag: part.etag })
    await env.KV.put(
      `multipart:${fileId}`,
      JSON.stringify({ uploadId, objectKey, parts, fileName: JSON.parse(multipartData).fileName }),
      { expirationTtl: 60 * 60 * 24 },
    )

    return new Response(
      JSON.stringify({
        partNumber,
        etag: part.etag,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (err) {
    console.error("Part upload failed:", err)
    return new Response(JSON.stringify({ error: "Part upload failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
