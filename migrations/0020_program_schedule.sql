-- Migration: 정규 수업(class/program) 반복 일정 — 캘린더 표시용
-- Target DB: Cloudflare D1 (SQLite). ※ 0007·0008·0019만 MySQL, 나머지는 D1 대상.
-- Description:
--   programs의 schedule_ko/en은 사람이 읽는 자유 텍스트라 캘린더에 날짜로 매핑할 수 없다.
--   정규 수업을 캘린더에 매주 반복 표시하기 위해 구조화된 요일·시간·학기 기간을 추가한다.
--   camp는 기존 start_date/end_date(기간)를 그대로 쓰고, 이 컬럼들은 class/program용이다.
--   weekdays: 쉼표구분 요일 번호(0=일 ~ 6=토, JS Date.getDay 기준). 예 "6"=토, "1,3"=월·수.
--   term_*: 학기 시작·종료일(YYYY-MM-DD). 비우면 상시(해당 월 전체에 매주 표시).
-- Apply: npm run d1:migrate migrations/0020_program_schedule.sql
--   (ALTER ADD COLUMN 재실행 시 "duplicate column name"은 러너가 SKIP 처리 — 멱등)

ALTER TABLE programs ADD COLUMN weekdays TEXT;
ALTER TABLE programs ADD COLUMN class_start_time TEXT;
ALTER TABLE programs ADD COLUMN class_end_time TEXT;
ALTER TABLE programs ADD COLUMN term_start_date TEXT;
ALTER TABLE programs ADD COLUMN term_end_date TEXT;
