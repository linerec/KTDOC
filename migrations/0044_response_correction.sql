-- Migration: 수강신청 과목 정정 — 배정의 출처와 정정 이력의 구조
-- Target DB: Cloudflare D1 (SQLite). ※ 0007·0008·0019만 MySQL, 나머지는 D1 대상.
-- Description:
--   응답 #173이 과목을 잘못 넣고 배정까지 끝난 뒤 "제대로 고치는 길"이 없었다.
--   답을 고치는 화면이 없고, 재제출은 옛 배정을 남기며, 배정 해제는 아무에게도
--   알리지 않았다. 정정을 하나의 사건으로 만들려면 두 가지가 데이터에 있어야 한다.
--
--   program_enrollments.source_response_id
--     이 배정이 어느 응답에서 왔는가. 정정·재제출·취소가 배정을 거둘 때
--     **자기 응답 줄기가 만든 배정만** 건드리기 위한 근거다. 운영진이 수업 화면에서
--     직접 넣은 배정(NULL)은 신청서 쪽 사건이 손대지 않는다.
--     예전에는 note 에 '신청서 접수 #173' 문자열로만 남아 있었다 — 백필 스크립트가 옮긴다.
--
--   form_response_notes.payload_json
--     정정 이력의 구조 — 무엇에서 무엇으로, 배정에 무슨 영향, 안내가 나갔는가,
--     예고인가 적용인가. 자유 문장(body)은 사람이 읽고, payload 는 화면이 읽는다.
--     kind 에 'correction' 이 추가된다(kind 는 TEXT 라 제약 변경 없음).

ALTER TABLE program_enrollments ADD COLUMN source_response_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_pe_source_response ON program_enrollments(source_response_id);

ALTER TABLE form_response_notes ADD COLUMN payload_json TEXT;
