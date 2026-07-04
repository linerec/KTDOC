-- migrations/0026_supplies.sql
-- 준비물(What to Bring) — 재사용 카탈로그 + 이벤트/수업 연결
-- 운영진이 준비물 항목을 카탈로그로 등록하고, 이벤트/수업에 골라 붙인다.
-- 학생·학부모는 이벤트/수업에서 '무엇을 챙겨야 하는지' 확인한다.
-- SQLite dialect (Cloudflare D1). Apply with:
--   node scripts/d1Migrate.mjs migrations/0026_supplies.sql

-- 준비물 카탈로그(재사용 항목)
CREATE TABLE IF NOT EXISTS supply_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_ko TEXT NOT NULL,
  name_en TEXT,
  description_ko TEXT,       -- 무엇인지 / 어디서 구하는지
  description_en TEXT,
  image_url TEXT,            -- 대표 사진/아이콘
  image_r2_key TEXT,
  glossary_term_id INTEGER REFERENCES glossary_terms(id) ON DELETE SET NULL,  -- 말모이 용어 연결(발음·뜻)
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_supply_items_active ON supply_items(is_active);
CREATE INDEX IF NOT EXISTS idx_supply_items_slug ON supply_items(slug);
CREATE INDEX IF NOT EXISTS idx_supply_items_sort ON supply_items(sort_order, id);

-- 이벤트 ↔ 준비물 (다대다). 이벤트 한정 수량·비고·필수여부를 붙인다.
CREATE TABLE IF NOT EXISTS event_supplies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  supply_item_id INTEGER NOT NULL REFERENCES supply_items(id) ON DELETE CASCADE,
  quantity TEXT,            -- 예: "2개", "검정색 1"
  note_ko TEXT,             -- 이 이벤트 한정 추가 안내
  note_en TEXT,
  is_required INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(event_id, supply_item_id)
);

CREATE INDEX IF NOT EXISTS idx_event_supplies_event ON event_supplies(event_id, sort_order);

-- 수업(Program) ↔ 준비물 (다대다)
CREATE TABLE IF NOT EXISTS program_supplies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  supply_item_id INTEGER NOT NULL REFERENCES supply_items(id) ON DELETE CASCADE,
  quantity TEXT,
  note_ko TEXT,
  note_en TEXT,
  is_required INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(program_id, supply_item_id)
);

CREATE INDEX IF NOT EXISTS idx_program_supplies_program ON program_supplies(program_id, sort_order);
