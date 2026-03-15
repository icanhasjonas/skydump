import { Hono } from "hono"
import type { Bindings } from "../types"

const app = new Hono<{ Bindings: Bindings }>()

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// GET /api/admin/uploads
app.get("/uploads", async (c) => {
  const limit = Math.min(Number.parseInt(c.req.query("limit") || "50", 10), 200)
  const offset = Math.max(Number.parseInt(c.req.query("offset") || "0", 10), 0)
  const status = c.req.query("status") || "completed"

  try {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM uploads WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
      .bind(status, limit, offset)
      .all()

    const baseUrl = new URL(c.req.url).origin

    const uploads = (results || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      fileName: row.file_name,
      fileSize: row.file_size,
      contentType: row.content_type,
      ip: row.ip,
      userAgent: row.user_agent,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      downloadUrl: `${baseUrl}/api/download/${row.id}`,
    }))

    const countResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM uploads WHERE status = ?",
    )
      .bind(status)
      .first()

    return json({
      uploads,
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        hasMore: offset + limit < ((countResult?.total as number) || 0),
      },
    })
  } catch (err) {
    console.error("Admin query failed:", err)
    return json({ error: "Query failed" }, 500)
  }
})

// Catch-all for unsupported methods
app.all("/*", () => json({ error: "Method not allowed" }, 405))

export default app
