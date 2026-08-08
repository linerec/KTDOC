-- 0033: 푸시 알림 구독 추적 (MySQL)
--
-- 지금까지 push_subscriptions는 "현재 켜져 있는 기기"만 담았다. 회원이 알림을
-- 끄거나 구독이 만료되면 행을 지웠기 때문에 (1) 언제 누가 껐는지, (2) 켜 둔
-- 기기에 알림이 실제로 도달했는지를 운영진이 알 수 없었다.
--
-- 두 가지를 더한다:
--   1) push_subscriptions 도달 집계 — 기기별 성공/실패 횟수와 마지막 시각.
--      (last_used_at은 '구독 등록·갱신' 시각이라 도달 시각과 의미가 다르다.)
--   2) push_subscription_events — 켜기/끄기/만료 생명주기 이력. 행이 지워져도
--      "그 기기가 있었다"는 사실이 남는다.
--
-- 적용: node scripts/mysqlMigrate.mjs migrations/0033_push_tracking.sql

-- 1) 기기별 도달 집계
ALTER TABLE push_subscriptions ADD COLUMN last_success_at DATETIME NULL;

ALTER TABLE push_subscriptions ADD COLUMN last_failure_at DATETIME NULL;

ALTER TABLE push_subscriptions ADD COLUMN success_count INT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE push_subscriptions ADD COLUMN fail_count INT UNSIGNED NOT NULL DEFAULT 0;

-- 2) 생명주기 이력
--    endpoint 원문은 남기지 않는다(길고, 그 자체가 발송 가능한 주소다).
--    같은 기기를 추적하는 데는 해시로 충분하다.
--    회원 탈퇴 시 이력도 함께 지운다(개인정보 최소 보관) — push_subscriptions와 동일.
CREATE TABLE IF NOT EXISTS push_subscription_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  event ENUM('subscribed', 'unsubscribed', 'expired') NOT NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pse_created (created_at),
  KEY idx_pse_user (user_id, created_at),
  CONSTRAINT fk_pse_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 이 마이그레이션 이전에 켜 둔 기기는 이력이 없다. 소급 기록은 하지 않는다 —
-- 현황 표는 push_subscriptions.created_at(등록일)을 그대로 쓰므로 이력이 비어도
-- "언제 켰는지"는 보인다. 이력은 이 시점 이후의 변화를 쌓는다.
