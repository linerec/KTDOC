-- migrations/0005_events_signature.sql
-- 공연 쇼케이스(/performances)를 위한 events 큐레이션 컬럼.
-- 기존 events 테이블 재사용 — 추가 컬럼만. (SQLite는 ALTER당 1컬럼)
-- Apply: wrangler d1 execute ktdoc-db --remote --file=./migrations/0005_events_signature.sql

ALTER TABLE events ADD COLUMN is_signature INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN signature_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_events_signature ON events(is_signature, signature_order);
