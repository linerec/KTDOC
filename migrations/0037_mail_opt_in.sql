-- 0037: 회원 이메일 수신 설정 (MySQL)
--
-- 원장이 켠 알림이라도 회원이 스스로 끌 수 있게 한다 — 과하다는 민원과
-- 스팸 신고를 동시에 막는 최소선이다.
--
-- 기본값 1: 기존 회원 전원이 받는 상태로 시작한다(끄는 것은 본인의 선택이지,
-- 마이그레이션이 대신 정할 일이 아니다).
--
-- 필수(essential) 이벤트 — 가입 확인·임시 비밀번호 — 는 이 값을 보지 않는다.
-- 못 받으면 계정을 쓸 수 없기 때문이다(lib/mail/recipients.ts).
--
-- 적용: node scripts/mysqlMigrate.mjs migrations/0037_mail_opt_in.sql

ALTER TABLE users ADD COLUMN email_opt_in TINYINT(1) NOT NULL DEFAULT 1;
