-- migrations/0003_gallery_photos.sql
-- 날짜/이벤트가 정리되기 전 사진을 먼저 올려 공개할 수 있는 보관함

CREATE TABLE IF NOT EXISTS gallery_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  caption_ko TEXT,
  caption_en TEXT,
  taken_date TEXT,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  event_image_id INTEGER REFERENCES event_images(id) ON DELETE SET NULL,
  is_published INTEGER DEFAULT 0,
  is_featured INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  size INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gallery_photos_published ON gallery_photos(is_published);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_taken_date ON gallery_photos(taken_date);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_event ON gallery_photos(event_id);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_sort ON gallery_photos(sort_order, created_at);
