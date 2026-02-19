CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT DEFAULT 'application/octet-stream',
  ip TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_uploads_created_at ON uploads(created_at DESC);
CREATE INDEX idx_uploads_status ON uploads(status);
