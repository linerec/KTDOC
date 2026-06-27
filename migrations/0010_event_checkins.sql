-- Migration: 이벤트 체크인(학생 참여 기록)
-- Target DB: Cloudflare D1 (SQLite). ※ 0001~0006·0009·0010은 D1, 0007·0008만 MySQL 대상.
-- Description:
--   학생(원생)이 자신이 참가한(또는 참가할) 이벤트에 체크인한다. 체크아웃 = 행 삭제.
--   user_id = MySQL users.id (UUID 문자열). 저장소가 달라(D1↔MySQL) FK는 걸지 않는다.
--   이 데이터로 (1) 학생 본인 아카이브(체크인한 이벤트+사진), (2) 이벤트별 참여도(참가자 수),
--   (3) 연도별 수강생 페이지의 활동 지표를 만든다.
--   status: 'attended'(참가 완료) 기본. 향후 'going'(참가 예정) 등으로 확장 가능.
-- Apply: npm run d1:migrate migrations/0010_event_checkins.sql

CREATE TABLE IF NOT EXISTS event_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,                       -- MySQL users.id (UUID). 교차 저장소라 FK 없음.
  status TEXT NOT NULL DEFAULT 'attended',     -- 'attended' | (향후) 'going'
  note TEXT,                                   -- 학생 메모(선택)
  checked_in_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_checkins_event ON event_checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user ON event_checkins(user_id);
