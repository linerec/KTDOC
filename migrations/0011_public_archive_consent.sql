-- Migration: 공개 수강생 페이지(/students) 노출 동의(opt-in)
-- Target DB: MySQL (lib/db.ts / `users` 테이블). ※ 0007·0008·0011만 MySQL, 0001~0006·0009·0010은 D1.
-- Description:
--   공개 연도별 수강생 페이지에 본인을 노출할지 학생이 직접 동의(내 프로필에서 토글)한다.
--   미성년자 등 개인정보 보호를 위해 기본값은 0(비공개) — 동의한 학생만 공개 명단에 표시된다.
-- Apply(MySQL): node 스크립트 또는 mysql 클라이언트로 직접 실행.

ALTER TABLE users
  ADD COLUMN public_archive_consent tinyint(1) NOT NULL DEFAULT 0 AFTER enrollment_year;
