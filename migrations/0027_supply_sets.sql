-- migrations/0027_supply_sets.sql
-- 준비물 세트(Set) — 여러 준비물 항목을 하나로 묶은 상위 레이어.
-- 이벤트/수업에는 개별 항목(event_supplies)과 세트(event_supply_sets)를 자유롭게 섞어 지정한다.
-- 기존 event_supplies/program_supplies(항목 연결)는 그대로 두고 세트 연결 테이블만 추가한다.
-- SQLite dialect (Cloudflare D1). Apply with:
--   node scripts/d1Migrate.mjs migrations/0027_supply_sets.sql

-- 세트 정의
CREATE TABLE IF NOT EXISTS supply_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_ko TEXT NOT NULL,
  name_en TEXT,
  description_ko TEXT,
  description_en TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_supply_sets_active ON supply_sets(is_active);
CREATE INDEX IF NOT EXISTS idx_supply_sets_slug ON supply_sets(slug);
CREATE INDEX IF NOT EXISTS idx_supply_sets_sort ON supply_sets(sort_order, id);

-- 세트 구성(세트 ↔ 항목)
CREATE TABLE IF NOT EXISTS supply_set_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id INTEGER NOT NULL REFERENCES supply_sets(id) ON DELETE CASCADE,
  supply_item_id INTEGER NOT NULL REFERENCES supply_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(set_id, supply_item_id)
);

CREATE INDEX IF NOT EXISTS idx_supply_set_items_set ON supply_set_items(set_id, sort_order);

-- 이벤트 ↔ 세트
CREATE TABLE IF NOT EXISTS event_supply_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  supply_set_id INTEGER NOT NULL REFERENCES supply_sets(id) ON DELETE CASCADE,
  quantity TEXT,
  note_ko TEXT,
  note_en TEXT,
  is_required INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(event_id, supply_set_id)
);

CREATE INDEX IF NOT EXISTS idx_event_supply_sets_event ON event_supply_sets(event_id, sort_order);

-- 수업(Program) ↔ 세트
CREATE TABLE IF NOT EXISTS program_supply_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  supply_set_id INTEGER NOT NULL REFERENCES supply_sets(id) ON DELETE CASCADE,
  quantity TEXT,
  note_ko TEXT,
  note_en TEXT,
  is_required INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(program_id, supply_set_id)
);

CREATE INDEX IF NOT EXISTS idx_program_supply_sets_program ON program_supply_sets(program_id, sort_order);
