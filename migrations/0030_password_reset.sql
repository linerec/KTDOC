-- 0030: 운영진 발급형 임시 비밀번호 (MySQL)
-- 신뢰·접근성 개선 Phase Step 1 — docs/operations/ux-trust-accessibility-phase.md
--
-- 비밀번호를 잊은 회원에게 운영진(선생님·관리자)이 임시 비밀번호를 발급한다.
-- 임시 비밀번호로 로그인하면 must_change_password 플래그에 따라 새 비밀번호
-- 설정 페이지(/account/password)로 강제 이동한다.
--
-- 적용: node scripts/mysqlMigrate.mjs migrations/0030_password_reset.sql

ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0;

-- 발급 이력(감사용): 언제, 어느 운영진이 발급했는지
ALTER TABLE users ADD COLUMN temp_password_issued_at DATETIME NULL;

ALTER TABLE users ADD COLUMN temp_password_issued_by VARCHAR(36) NULL;
