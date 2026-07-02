-- Migration: 수업·프로그램 수강생(원생 배정)
-- Target DB: Cloudflare D1 (SQLite). ※ 0007·0008·0019만 MySQL, 나머지는 D1 대상.
-- Description:
--   운영진(관리자·선생님)이 수업·프로그램(programs)에 원생(회원)을 수강생으로 배정한다.
--   user_id = MySQL users.id (UUID 문자열). 저장소가 달라(D1↔MySQL) FK는 걸지 않는다.
--   enrolled_by = 배정한 운영진 user.id(감사용, 선택).
--   이 데이터로 (1) 운영진의 프로그램별 수강생 명단, (2) 원생 본인의 '내 수업',
--   (3) 학부모의 자녀 수업 화면을 만든다. 회원 이름은 호출부에서 getUserNamesByIds(MySQL)로 해석.
--   status: 'active'(수강 중) 기본 · 'waitlist'(대기) · 'completed'(수료) · 'cancelled'(취소).
-- Apply: npm run d1:migrate migrations/0018_program_enrollments.sql

CREATE TABLE IF NOT EXISTS program_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,                       -- MySQL users.id (UUID). 교차 저장소라 FK 없음.
  status TEXT NOT NULL DEFAULT 'active',       -- 'active' | 'waitlist' | 'completed' | 'cancelled'
  note TEXT,                                   -- 운영진 메모(선택)
  enrolled_by TEXT,                            -- 배정한 운영진 MySQL users.id(선택)
  enrolled_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(program_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_enroll_program ON program_enrollments(program_id);
CREATE INDEX IF NOT EXISTS idx_enroll_user ON program_enrollments(user_id);
