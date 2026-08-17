-- 0036: 메일 발송 내역 (Cloudflare D1)
--
-- 성공만이 아니라 건너뛴 것도 남긴다 — "왜 안 왔지"의 답이 대부분 여기 있다.
-- 스위치가 꺼져 있었는지(skipped), 한도에 막혔는지(quota_blocked),
-- 주소가 없었는지(skipped + detail). 성공만 남기면 이 질문에 답할 수 없다.
--
-- 사용량 집계의 1차 근거이기도 하다. Resend가 To·CC·BCC의 각 수신자를
-- 1통으로 세므로 여기도 수신자당 1행이어야 게이지가 실제 잔량과 맞는다.
--
-- 적용: node scripts/d1Migrate.mjs migrations/0036_mail_log.sql

CREATE TABLE IF NOT EXISTS mail_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key     TEXT NOT NULL,
  audience      TEXT NOT NULL,              -- 'user' | 'staff'
  to_address    TEXT NOT NULL,
  subject       TEXT NOT NULL,
  -- redactBody 이벤트(임시 비밀번호 등)는 NULL.
  -- 단체 발송은 100명분 중복을 피해 대표 행 하나에만 저장한다.
  body          TEXT,
  status        TEXT NOT NULL,              -- sent | failed | skipped | quota_blocked
  detail        TEXT,
  provider      TEXT,
  provider_id   TEXT,
  -- 단체 발송(BCC) 묶음. 단건은 NULL.
  batch_id      TEXT,
  -- Resend 응답 헤더가 알려준 그 시점 사용량(자체 집계와 대조용)
  quota_daily   INTEGER,
  quota_monthly INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mail_log_created ON mail_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_log_event   ON mail_log(event_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_log_to      ON mail_log(to_address);
CREATE INDEX IF NOT EXISTS idx_mail_log_status  ON mail_log(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_log_batch   ON mail_log(batch_id);
