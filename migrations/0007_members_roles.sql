-- Migration: 회원 역할 분리 · 승인 워크플로우 · 학부모-원생 연결
-- Target DB: MySQL (lib/db.ts / `users` 테이블). ※ 다른 0001~0006은 Cloudflare D1(SQLite)용이며,
--            이 파일만 MySQL을 대상으로 한다.
-- Description:
--   1) users.role 을 원생/학부모/선생님/관리자로 확장
--   2) status(승인 상태) · phone · enrollment_year(입학년도) · approved_by/at 컬럼 추가
--   3) 기존 회원은 모두 정회원(active)으로 전환해 잠김 방지
--   4) student_guardians: 학부모↔원생 연결(형제·복수 보호자 대비 조인 테이블)

-- 1) 역할 확장 (기존 'user'/'admin' 행 보존)
ALTER TABLE users
  MODIFY COLUMN role enum('user','student','parent','teacher','admin')
    COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'student';

-- 2) 승인 상태 · 원생/연락 필드
ALTER TABLE users
  ADD COLUMN phone varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER name,
  ADD COLUMN status enum('pending','active','rejected','suspended')
    COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' AFTER role,
  ADD COLUMN enrollment_year smallint DEFAULT NULL AFTER status,
  ADD COLUMN approved_by varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ADD COLUMN approved_at datetime DEFAULT NULL;

-- 3) 기존 회원은 정회원으로 (관리자·테스트 계정 잠김 방지)
UPDATE users SET status = 'active';

-- 4) 학부모↔원생 연결
CREATE TABLE IF NOT EXISTS student_guardians (
  id varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  guardian_id varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,           -- 학부모 user.id
  student_id varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,        -- 연결된 원생 user.id (미해결 시 null)
  claimed_student_name varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL, -- 학부모가 입력한 자녀 이름
  claimed_enrollment_year smallint DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sg_guardian (guardian_id),
  KEY idx_sg_student (student_id),
  CONSTRAINT fk_sg_guardian FOREIGN KEY (guardian_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sg_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
