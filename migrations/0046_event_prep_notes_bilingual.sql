-- Migration: 준비물 · 복장 · 안내를 한/영 두 벌로
-- Target DB: Cloudflare D1 (SQLite)
-- Description:
--   events.prep_notes 한 칸에는 한국어만 적을 수 있었다. 이 칸은 공연 전날 안내 메일과
--   회람(/rsvp) 공지, 회원 상세에 그대로 실리는데, 영어가 편한 가족에게는 읽히지 않는
--   글자였다. 다른 콘텐츠 필드가 모두 _ko/_en 두 벌인 것과도 어긋났다.
--
--   - prep_notes → prep_notes_ko 로 이름을 고친다. 이름이 사실을 말하게 하려는 것이다.
--     (prep_notes 옆에 prep_notes_en 만 더하면, 다음 사람은 prep_notes를 "언어 무관
--      통합 칸"으로 읽는다. 적용 시점 기준 값이 있는 행은 5건이고 모두 한국어다.)
--   - prep_notes_en 을 더한다. 비어 있으면 화면·메일은 한국어로 물러선다.
--
-- Apply: npm run d1:migrate migrations/0046_event_prep_notes_bilingual.sql
--   재실행 시 RENAME은 "no such column: prep_notes"로 건너뛴다(러너가 처리).

ALTER TABLE events RENAME COLUMN prep_notes TO prep_notes_ko;
ALTER TABLE events ADD COLUMN prep_notes_en TEXT;
