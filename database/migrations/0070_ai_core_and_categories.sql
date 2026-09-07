PRAGMA foreign_keys = OFF;

ALTER TABLE inspiration_categories RENAME TO inspiration_categories_v61;
ALTER TABLE inspirations RENAME TO inspirations_v61;

CREATE TABLE inspiration_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, name)
);

INSERT INTO inspiration_categories (id,user_id,name,sort_order,created_at,updated_at)
SELECT id,user_id,trim(name, ' 。、'),ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at,id)-1,created_at,updated_at
FROM inspiration_categories_v61
WHERE id NOT LIKE user_id || ':design'
  AND id NOT LIKE user_id || ':ai'
  AND id NOT LIKE user_id || ':photography'
  AND id NOT LIKE user_id || ':fashion'
  AND id NOT LIKE user_id || ':music'
  AND id NOT LIKE user_id || ':business'
  AND trim(name, ' 。、') <> '';

CREATE TABLE inspirations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT NOT NULL,
  image TEXT,
  category_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(category_id) REFERENCES inspiration_categories(id) ON DELETE SET NULL
);

INSERT INTO inspirations (id,user_id,platform,content,url,image,category_id,created_at,updated_at)
SELECT i.id,i.user_id,i.platform,i.content,i.url,i.image,c.id,i.created_at,i.updated_at
FROM inspirations_v61 i
LEFT JOIN inspiration_categories c ON c.id=i.category_id AND c.user_id=i.user_id;

DROP TABLE inspirations_v61;
DROP TABLE inspiration_categories_v61;

CREATE TABLE IF NOT EXISTS ai_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS inspirations_user_idx ON inspirations(user_id);
CREATE INDEX IF NOT EXISTS inspiration_categories_user_idx ON inspiration_categories(user_id);
CREATE INDEX IF NOT EXISTS ai_reports_user_idx ON ai_reports(user_id, created_at DESC);

PRAGMA foreign_keys = ON;
