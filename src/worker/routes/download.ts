import { Hono } from "hono"
import type { Bindings } from "../types"

const app = new Hono<{ Bindings: Bindings }>()

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// GET /api/download/:fileId
app.get("/:fileId", async (c) => {
  const fileId = c.req.param("fileId")

  if (!fileId) {
    return json({ error: "fileId required" }, 400)
  }

  try {
    const row = await c.env.DB.prepare(
      "SELECT * FROM uploads WHERE id = ? AND status = 'completed'",
    )
      .bind(fileId)
      .first()

    if (!row) {
      return json({ error: "File not found" }, 404)
    }

    const object = await c.env.R2.get(row.object_key as string)
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
})

// Catch-all for unsupported methods
app.all("/*", () => json({ error: "Method not allowed" }, 405))

export default app
