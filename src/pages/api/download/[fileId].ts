import type { APIRoute } from "astro"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const GET: APIRoute = async ({ locals, params }) => {
  const { env } = locals.runtime
  const { fileId } = params

  if (!fileId) {
    return json({ error: "fileId required" }, 400)
  }

  try {
    const row = await env.DB.prepare("SELECT * FROM uploads WHERE id = ? AND status = 'completed'")
      .bind(fileId)
      .first()

    if (!row) {
      return json({ error: "File not found" }, 404)
    }

    const object = await env.R2.get(row.object_key as string)
    if (!object) {
      return json({ error: "File not found in storage" }, 404)
    }

    return new Response(object.body, {
      headers: {
        "Content-Type": (row.content_type as string) || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(row.file_name as string)}"`,
        "Content-Length": String(row.file_size),
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (err) {
    console.error("Download failed:", err)
    return json({ error: "Download failed" }, 500)
  }
}

export const ALL: APIRoute = () => json({ error: "Method not allowed" }, 405)
