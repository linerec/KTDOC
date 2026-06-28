-- 0016_notification_recipients.sql (MySQL)
-- 알림 수신자별 인박스. 발송 1건(notifications)을 대상 회원 수만큼 펼쳐 저장한다.
-- 각 회원은 본인 행을 /admin/inbox 에서 읽음 처리하거나 삭제(행 제거)할 수 있다.
-- 푸시를 받지 못한(알림 미설정) 회원도 여기 행이 생겨 로그인 후 확인할 수 있다.

CREATE TABLE IF NOT EXISTS notification_recipients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_id BIGINT UNSIGNED NOT NULL,
  user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_notif_user (notification_id, user_id),
  KEY idx_recip_user (user_id, read_at),
  CONSTRAINT fk_recip_notif FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE,
  CONSTRAINT fk_recip_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
