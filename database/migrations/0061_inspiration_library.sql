PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO profiles (user_id, display_name, bio, avatar_url, created_at, updated_at)
SELECT id, display_name, bio, avatar_url, created_at, updated_at FROM users;

CREATE TABLE IF NOT EXISTS inspiration_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, name)
);

INSERT OR IGNORE INTO inspiration_categories (id, user_id, name, is_default, created_at, updated_at)
SELECT users.id || ':' || defaults.slug, users.id, defaults.name, 1, users.created_at, users.updated_at
FROM users
CROSS JOIN (
  SELECT 'design' AS slug, '设计' AS name
  UNION ALL SELECT 'ai', 'AI'
  UNION ALL SELECT 'photography', '摄影'
  UNION ALL SELECT 'fashion', '穿搭'
  UNION ALL SELECT 'music', '音乐'
  UNION ALL SELECT 'business', '商业'
) AS defaults;

ALTER TABLE inspirations RENAME TO inspirations_v60;

CREATE TABLE inspirations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT NOT NULL,
  image TEXT,
  category_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(category_id) REFERENCES inspiration_categories(id) ON DELETE RESTRICT
);

INSERT OR IGNORE INTO inspirations (id, user_id, platform, content, url, image, category_id, created_at, updated_at)
SELECT
  id,
  user_id,
  COALESCE(json_extract(payload_json, '$.platform'), '抖音'),
  COALESCE(json_extract(payload_json, '$.content'), json_extract(payload_json, '$.title'), '历史灵感'),
  COALESCE(json_extract(payload_json, '$.url'), json_extract(payload_json, '$.source'), ''),
  json_extract(payload_json, '$.image'),
  user_id || ':design',
  created_at,
  updated_at
FROM inspirations_v60;

DROP TABLE inspirations_v60;

CREATE INDEX IF NOT EXISTS profiles_user_idx ON profiles(user_id);
CREATE INDEX IF NOT EXISTS inspirations_user_idx ON inspirations(user_id);
CREATE INDEX IF NOT EXISTS inspiration_categories_user_idx ON inspiration_categories(user_id);

PRAGMA foreign_keys = ON;
