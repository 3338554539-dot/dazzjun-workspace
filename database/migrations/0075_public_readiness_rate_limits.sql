CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT NOT NULL,
  scope TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(scope, key)
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_updated_idx
  ON rate_limit_buckets(updated_at);
