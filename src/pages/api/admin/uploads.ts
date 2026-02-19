import type { APIRoute } from "astro"

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export const GET: APIRoute = async ({ locals, url }) => {
  const { env } = locals.runtime

  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") || "50", 10), 200)
  const offset = Math.max(Number.parseInt(url.searchParams.get("offset") || "0", 10), 0)
  const status = url.searchParams.get("status") || "completed"

  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM uploads WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
      .bind(status, limit, offset)
      .all()

    const baseUrl = url.origin

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

    const countResult = await env.DB.prepare(
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
}

export const ALL: APIRoute = () => json({ error: "Method not allowed" }, 405)
