-- Migration: 갤러리 사진 업로더(제출자) 추적
-- Target DB: Cloudflare D1 (SQLite). ※ 0001~0006·0009는 D1, 0007·0008만 MySQL 대상.
-- Description:
--   학생·학부모가 관리 콘솔 "공연 · 갤러리 둘러보기 > 내 사진 · 제출"에서 올린
--   사진의 출처(제출자)를 추적한다.
--   uploaded_by = MySQL users.id (UUID 문자열). NULL = 운영진이 직접 올린 사진(기존 동작).
--   저장소가 달라(D1 ↔ MySQL) FK는 걸지 않는다 — 식별자 문자열만 보관한다.
--   학생 제출분은 항상 비공개(is_published=0)·미분류(event_id NULL)로 들어오며,
--   운영진이 사진 보관함에서 검토 후 공개·이벤트 연결한다.

ALTER TABLE gallery_photos ADD COLUMN uploaded_by TEXT;

CREATE INDEX IF NOT EXISTS idx_gallery_photos_uploaded_by ON gallery_photos(uploaded_by);
