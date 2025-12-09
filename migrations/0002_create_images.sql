-- Migration: Create images table
-- Description: Stores image metadata for ImageObject system

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keycode TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  alt_ko TEXT,
  alt_en TEXT,
  width INTEGER,
  height INTEGER,
  size INTEGER,
  content_type TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create index for faster keycode lookups
CREATE INDEX IF NOT EXISTS idx_images_keycode ON images(keycode);

-- Insert initial placeholder data for category cards
INSERT INTO images (keycode, url, r2_key, alt_ko, alt_en) VALUES
  ('category.performance', '/assets/images/placeholder.png', '', '공연', 'Performance'),
  ('category.education', '/assets/images/placeholder.png', '', '교육', 'Education'),
  ('category.community', '/assets/images/placeholder.png', '', '커뮤니티 활동', 'Community'),
  ('category.media', '/assets/images/placeholder.png', '', '미디어', 'Media');
