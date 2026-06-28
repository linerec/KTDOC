-- 0014_notifications.sql (MySQL)
-- 운영진(관리자·선생님)이 보낸 푸시 알림의 발송 로그/히스토리.
-- 발송 화면(/admin/notify)에서 최근 발송 내역과 도달/실패 수를 보여준다.
-- 수신자별 영구 보관이 아니라 "발송 1건"을 한 행으로 기록한다.

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  url VARCHAR(500) NULL,
  target_type ENUM('all','role','user') NOT NULL,
  target_value VARCHAR(200) NULL,
  sent_count INT NOT NULL DEFAULT 0,
  fail_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
