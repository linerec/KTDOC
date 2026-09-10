-- migrations/0045_events_hero.sql
-- 대표 공연(Signature Works) 플래그 — /performances 맨 위 배너에 세울 공연.
--
-- 왜 따로 두나: is_signature는 "아래 레퍼토리 목록에 표시"고 signature_order는 그
-- 목록 안의 순서다. 배너까지 그 숫자로 정하게 하니 "하나만 1을 주라"는 규칙을 사람이
-- 기억해야 했다. 대표 공연은 켜고 끄는 플래그 하나로 두고, 여럿이면 배너가 슬라이드쇼가
-- 된다(2026-09-10 결정). (SQLite는 ALTER당 1컬럼)
-- Apply: node scripts/d1Migrate.mjs migrations/0045_events_hero.sql

ALTER TABLE events ADD COLUMN is_hero INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_events_hero ON events(is_hero, event_date);
