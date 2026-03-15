import { Hono } from "hono"
import admin from "./routes/admin"
import download from "./routes/download"
import upload from "./routes/upload"
import type { Bindings } from "./types"

const app = new Hono<{ Bindings: Bindings }>()

app.route("/api/upload", upload)
app.route("/api/download", download)
app.route("/api/admin", admin)

// Fallback: serve static assets
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
