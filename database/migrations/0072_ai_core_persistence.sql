PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ai_context_authorizations (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  authorized INTEGER NOT NULL DEFAULT 0 CHECK(authorized IN (0,1)),
  authorized_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_date TEXT NOT NULL,
  summary TEXT NOT NULL,
  status_analysis TEXT NOT NULL DEFAULT '',
  growth_advice TEXT NOT NULL DEFAULT '',
  generated_at TEXT NOT NULL,
  UNIQUE(user_id, insight_date)
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_conversation_idx
  ON ai_conversations(user_id, conversation_id, created_at, id);

CREATE INDEX IF NOT EXISTS ai_insights_user_date_idx
  ON ai_insights(user_id, insight_date DESC);
