CREATE TABLE IF NOT EXISTS learning_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learning_id TEXT NOT NULL,
  block_type TEXT NOT NULL CHECK(block_type IN ('image','file')),
  object_key TEXT NOT NULL UNIQUE,
  thumbnail_key TEXT,
  name TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  mime TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','uploaded','attached')),
  attached_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS learning_assets_user_learning_idx
  ON learning_assets(user_id, learning_id, created_at);

CREATE INDEX IF NOT EXISTS learning_assets_status_created_idx
  ON learning_assets(status, created_at);
