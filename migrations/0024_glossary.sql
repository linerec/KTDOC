-- migrations/0024_glossary.sql
-- 말모이(Word Guide) — 한국 전통무용 용어 사전 + 발음 가이드
-- SQLite dialect (Cloudflare D1), mirrors 0002_gallery.sql / 0004_programs.sql conventions.
-- Apply with:
--   npm run d1:migrate   (or wrangler d1 execute ktdoc-db --remote --file=./migrations/0024_glossary.sql)

-- 용어 분류(춤사위 / 장단·호흡 / 소품·복식 / 예절·기본 / 기타)
CREATE TABLE IF NOT EXISTS glossary_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_ko TEXT NOT NULL,
  name_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_glossary_categories_sort ON glossary_categories(sort_order, id);

-- 용어 테이블
--   term_ko       : 한글 용어(예: 춤사위)
--   term_en       : 영문 의미/번역(예: Dance Movement)
--   romanization  : 로마자 표기(검색·표준용, 예: chumsawi)
--   pronunciation : 읽기 발음 가이드(아이 발화용, 예: choom-sah-wee)
CREATE TABLE IF NOT EXISTS glossary_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  term_ko TEXT NOT NULL,
  term_en TEXT,
  romanization TEXT,
  pronunciation TEXT,
  definition_ko TEXT,
  definition_en TEXT,
  example_ko TEXT,
  example_en TEXT,
  category_id INTEGER REFERENCES glossary_categories(id) ON DELETE SET NULL,
  image_url TEXT,
  image_r2_key TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_glossary_terms_published ON glossary_terms(is_published);
CREATE INDEX IF NOT EXISTS idx_glossary_terms_slug ON glossary_terms(slug);
CREATE INDEX IF NOT EXISTS idx_glossary_terms_category ON glossary_terms(category_id);
CREATE INDEX IF NOT EXISTS idx_glossary_terms_sort ON glossary_terms(sort_order, id);

-- 기본 분류 시드(멱등: slug UNIQUE + OR IGNORE)
INSERT OR IGNORE INTO glossary_categories (slug, name_ko, name_en, sort_order) VALUES
  ('movements', '춤사위', 'Movements', 1),
  ('rhythm', '장단 · 호흡', 'Rhythm & Breath', 2),
  ('props', '소품 · 복식', 'Props & Costume', 3),
  ('etiquette', '예절 · 기본', 'Etiquette & Basics', 4),
  ('misc', '기타', 'Others', 9);
