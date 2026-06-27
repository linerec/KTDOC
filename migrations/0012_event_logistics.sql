-- Migration: 이벤트 실행 정보(위치·시간·준비물)
-- Target DB: Cloudflare D1 (SQLite). 멤버가 다가오는 이벤트의 "어디서·언제·무엇을 준비"를 바로 파악하도록.
-- Description:
--   기존 events 테이블에 실행 정보 컬럼 추가(모두 nullable, additive).
--   - location:     장소명/주소 (예: "뉴저지 한인회관")
--   - location_url: 지도/길찾기 링크 (선택)
--   - call_time:    집합 시간 (예: "14:00") — 공연 준비 집합
--   - start_time:   시작 시간
--   - end_time:     종료 시간 (선택)
--   - prep_notes:   준비물·복장·안내 통합 메모
-- Apply: npm run d1:migrate migrations/0012_event_logistics.sql

ALTER TABLE events ADD COLUMN location TEXT;
ALTER TABLE events ADD COLUMN location_url TEXT;
ALTER TABLE events ADD COLUMN call_time TEXT;
ALTER TABLE events ADD COLUMN start_time TEXT;
ALTER TABLE events ADD COLUMN end_time TEXT;
ALTER TABLE events ADD COLUMN prep_notes TEXT;
