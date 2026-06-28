-- 0013_push_subscriptions.sql (MySQL)
-- 웹 푸시(Web Push) 구독 저장소.
-- 한 회원이 여러 기기/브라우저에서 구독할 수 있으므로 (user_id, endpoint) 단위로 저장한다.
-- endpoint는 길어서 UNIQUE 인덱스에 직접 쓸 수 없어 sha256 해시(endpoint_hash)로 유일성을 보장한다.
-- 회원 탈퇴 시 구독도 함께 제거(ON DELETE CASCADE).

-- user_id 는 users.id 와 동일한 타입·콜레이션(utf8mb4_unicode_ci)이어야 FK가 성립한다.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  endpoint TEXT NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_endpoint (user_id, endpoint_hash),
  KEY idx_push_user (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
