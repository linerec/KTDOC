-- migrations/0002_gallery.sql
-- Gallery (공연 아카이브) 테이블 생성

-- 카테고리 테이블
CREATE TABLE IF NOT EXISTS event_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 이벤트 테이블
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  year INTEGER NOT NULL,
  event_date TEXT NOT NULL,
  title_ko TEXT NOT NULL,
  title_en TEXT,
  description_ko TEXT,
  description_en TEXT,
  category_id INTEGER REFERENCES event_categories(id),
  poster_url TEXT,
  poster_r2_key TEXT,
  thumbnail_url TEXT,
  thumbnail_r2_key TEXT,
  is_featured INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_year ON events(year);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category_id);
CREATE INDEX IF NOT EXISTS idx_events_published ON events(is_published);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_featured ON events(is_featured);

-- 이벤트 이미지 테이블
CREATE TABLE IF NOT EXISTS event_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  caption_ko TEXT,
  caption_en TEXT,
  width INTEGER,
  height INTEGER,
  size INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_event_images_event ON event_images(event_id);

-- 이벤트 영상 테이블
CREATE TABLE IF NOT EXISTS event_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  youtube_url TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  title TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_event_videos_event ON event_videos(event_id);

-- 초기 카테고리 데이터
INSERT INTO event_categories (slug, name_ko, name_en, sort_order) VALUES
  ('competition', '경연대회', 'Competition', 1),
  ('festival', '축제', 'Festival', 2),
  ('corporate', '기업행사', 'Corporate Event', 3),
  ('cultural', '문화행사', 'Cultural Event', 4),
  ('other', '기타', 'Other', 99);
