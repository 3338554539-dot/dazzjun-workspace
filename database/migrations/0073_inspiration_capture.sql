ALTER TABLE inspiration_categories ADD COLUMN icon TEXT NOT NULL DEFAULT '';

ALTER TABLE inspirations ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE inspirations ADD COLUMN cover TEXT NOT NULL DEFAULT '';
ALTER TABLE inspirations ADD COLUMN author TEXT NOT NULL DEFAULT '';
ALTER TABLE inspirations ADD COLUMN source_text TEXT NOT NULL DEFAULT '';
ALTER TABLE inspirations ADD COLUMN category_name TEXT NOT NULL DEFAULT '';
ALTER TABLE inspirations ADD COLUMN ai_tags TEXT NOT NULL DEFAULT '[]';

UPDATE inspirations
SET
  title = CASE WHEN title = '' THEN content ELSE title END,
  cover = CASE WHEN cover = '' THEN COALESCE(image, '') ELSE cover END;

CREATE INDEX IF NOT EXISTS inspirations_user_platform_idx ON inspirations(user_id, platform, created_at DESC);
