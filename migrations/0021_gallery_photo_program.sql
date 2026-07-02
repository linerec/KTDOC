-- Migration: 보관함 사진을 수업(programs)에도 연결
-- Target DB: Cloudflare D1 (SQLite). ※ 0007·0008·0019만 MySQL, 나머지는 D1 대상.
-- Description:
--   gallery_photos는 event_id로 이벤트에 연결되는데, 학생이 '내 수업' 상세에서도 사진을
--   제출할 수 있도록 program_id 연결을 추가한다(이벤트/수업 중 하나에 선택적으로 연결).
--   program 삭제 시 사진은 보관함에 남기고 연결만 해제(SET NULL).
-- Apply: npm run d1:migrate migrations/0021_gallery_photo_program.sql
--   (ALTER ADD COLUMN 재실행 시 "duplicate column name"은 러너가 SKIP 처리 — 멱등)

ALTER TABLE gallery_photos ADD COLUMN program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gallery_photos_program ON gallery_photos(program_id);
