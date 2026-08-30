-- 0040: 발송 내역에 첨부 흔적 (Cloudflare D1)
--
-- 첨부는 "보냈다"만으로는 답이 안 되는 질문을 만든다 — "인보이스를 보냈던가,
-- 안내문만 보냈던가". 파일 내용은 보관하지 않는다(보존 기간·개인정보를 떠안게
-- 된다). 이름과 크기만 남기면 "무엇을 보냈나"에는 답할 수 있다.
--
-- 값: JSON 배열 [{"name":"수강료 안내.pdf","size":304128}], 첨부가 없으면 NULL.
--
-- 적용: node scripts/d1Migrate.mjs migrations/0040_mail_log_attachments.sql

ALTER TABLE mail_log ADD COLUMN attachments TEXT;
