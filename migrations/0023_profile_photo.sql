-- Migration: 회원 프로필 사진
-- Target DB: MySQL (lib/db.ts / `users` 테이블). ※ MySQL 마이그레이션: 0007·0008·0011·0013·0014·0019·0023
-- Description:
--   회원(주로 원생)이 내 프로필에서 직접 올리는 프로필 사진의 R2 공개 URL.
--   공개 수강생 페이지(/students)에는 public_archive_consent=1 인 학생의 사진만 노출된다.
--   nullable, additive — 사진이 없으면 이름 이니셜 아바타로 폴백한다.
-- Apply(MySQL): mysql 클라이언트로 직접 실행 (2026-07-02 원격 적용 완료).

ALTER TABLE users
  ADD COLUMN profile_photo_url VARCHAR(500) NULL AFTER public_archive_consent;
