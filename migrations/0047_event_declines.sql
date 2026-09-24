-- Migration: 공연 불참 응답
-- Target DB: Cloudflare D1 (SQLite)
-- Description:
--   둘러보기·회람의 참여 버튼은 '참여'밖에 말할 수 없었다. 가지 않는 사람은 아무것도
--   누르지 않았고, 운영진은 "안 간다"와 "아직 못 봤다"를 가를 수 없었다. 학생 화면의
--   "아직 참여 응답을 하지 않았습니다" 안내도 불참인 사람에게서 영영 사라지지 않았다.
--
--   불참은 event_checkins.status 가 아니라 따로 둔다. 체크인 표는 아카이브·참여 현황·
--   수강생 페이지·캘린더 표시가 전부 "행이 있으면 참여"로 읽는다. 불참을 같은 표에
--   넣으면 그 자리들이 모두 status 를 걸러야 하고, 하나라도 빠지면 불참한 공연이
--   '참여함'으로 뜬다. 참여와 불참은 서로를 밀어낸다(lib/d1/checkins.ts).
--
--   user_id = MySQL users.id (UUID). 저장소가 달라 FK 없음(event_checkins 와 같다).
--
-- Apply: npm run d1:migrate migrations/0047_event_declines.sql

CREATE TABLE IF NOT EXISTS event_declines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_declines_event ON event_declines(event_id);
CREATE INDEX IF NOT EXISTS idx_declines_user ON event_declines(user_id);
