-- migrations/0004_programs.sql
-- 수업·프로그램·캠프 + 신청(applications) 시스템
-- SQLite dialect, mirrors 0002_gallery.sql conventions.
-- Apply with the same runner used for 0002/0003, e.g.:
--   wrangler d1 execute ktdoc-db --remote --file=./migrations/0004_programs.sql

-- 프로그램(수업/프로그램/캠프) 테이블
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  program_type TEXT NOT NULL DEFAULT 'program'
    CHECK (program_type IN ('class', 'program', 'camp')),
  title_ko TEXT NOT NULL,
  title_en TEXT,
  summary_ko TEXT,
  summary_en TEXT,
  description_ko TEXT,
  description_en TEXT,
  age_range TEXT,
  schedule_ko TEXT,
  schedule_en TEXT,
  start_date TEXT,
  end_date TEXT,
  price_ko TEXT,
  price_en TEXT,
  location_ko TEXT,
  location_en TEXT,
  poster_url TEXT,
  poster_r2_key TEXT,
  thumbnail_url TEXT,
  thumbnail_r2_key TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_programs_type ON programs(program_type);
CREATE INDEX IF NOT EXISTS idx_programs_published ON programs(is_published);
CREATE INDEX IF NOT EXISTS idx_programs_slug ON programs(slug);
CREATE INDEX IF NOT EXISTS idx_programs_featured ON programs(is_featured);
CREATE INDEX IF NOT EXISTS idx_programs_sort ON programs(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_programs_type_pub ON programs(program_type, is_published);

-- 프로그램 묶음 사진 테이블 (event_images 구조 1:1)
CREATE TABLE IF NOT EXISTS program_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_program_images_program ON program_images(program_id);

-- 신청(지원) 테이블 — 신청자/미성년자 PII 보관. 프로그램 삭제 시 SET NULL + 제목 스냅샷으로 신청 기록 보존.
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  program_title_ko TEXT,
  applicant_name TEXT NOT NULL,
  guardian_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  participant_age TEXT,
  message TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'confirmed', 'cancelled')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_applications_program ON applications(program_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at);
