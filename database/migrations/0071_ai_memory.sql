PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ai_memory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK(memory_type IN ('preference','goal','habit','identity','insight')),
  content TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 3 CHECK(importance BETWEEN 1 AND 5),
  source TEXT NOT NULL DEFAULT 'user' CHECK(source IN ('user','ai','import')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_memory_user_idx ON ai_memory(user_id, importance DESC, updated_at DESC);
