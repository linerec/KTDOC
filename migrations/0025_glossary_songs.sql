-- migrations/0025_glossary_songs.sql
-- 말모이(Word Guide) 확장 — 노래(노랫말) 학습 자료
-- 별달거리처럼 가사를 줄 단위로 외워 부르는 노래를, 줄별 한국어/발음/영어로 정리한다.
-- SQLite dialect (Cloudflare D1). Apply with:
--   node scripts/d1Migrate.mjs migrations/0025_glossary_songs.sql

-- 노래 메타
CREATE TABLE IF NOT EXISTS glossary_songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title_ko TEXT NOT NULL,
  title_en TEXT,
  romanization TEXT,        -- 제목 로마자(예: byeoldalgeori)
  pronunciation TEXT,       -- 제목 읽기 발음(예: byeol-dal-geo-ri)
  description_ko TEXT,      -- 노래 배경·설명
  description_en TEXT,
  youtube_url TEXT,         -- 실제 곡을 들으며 따라 부르기용
  is_published INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_glossary_songs_published ON glossary_songs(is_published);
CREATE INDEX IF NOT EXISTS idx_glossary_songs_slug ON glossary_songs(slug);
CREATE INDEX IF NOT EXISTS idx_glossary_songs_sort ON glossary_songs(sort_order, id);

-- 가사 줄(순서 있는 줄별 한국어/발음/영어). 후렴은 is_refrain=1로 시각 구분.
CREATE TABLE IF NOT EXISTS glossary_song_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id INTEGER NOT NULL REFERENCES glossary_songs(id) ON DELETE CASCADE,
  line_order INTEGER NOT NULL DEFAULT 0,
  text_ko TEXT NOT NULL,
  romanization TEXT,
  pronunciation TEXT,
  text_en TEXT,
  is_refrain INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_glossary_song_lines_song ON glossary_song_lines(song_id, line_order);
