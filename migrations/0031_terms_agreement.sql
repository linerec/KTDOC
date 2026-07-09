-- 0031: 약관·개인정보처리방침 동의 시각 (MySQL)
-- 신뢰·접근성 개선 Phase Step 2 — docs/operations/ux-trust-accessibility-phase.md
--
-- 가입 시 이용약관·개인정보처리방침 동의를 필수화하고, 동의 사실의
-- 증빙(시각)을 남긴다. 기존 회원은 NULL(분리 도입 전 가입)로 둔다.
--
-- 적용: node scripts/mysqlMigrate.mjs migrations/0031_terms_agreement.sql

ALTER TABLE users ADD COLUMN terms_agreed_at DATETIME NULL;
