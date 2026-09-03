-- Migration: 수업 반복 주기(몇 째 주) + 날짜 단위 예외(휴강·보강)
-- Target DB: Cloudflare D1 (SQLite). ※ 0007·0008·0019만 MySQL, 나머지는 D1 대상.
-- Description:
--   0020이 만든 구조화 일정은 "매주 ○요일"밖에 말할 수 없었다. 학원의 성인반·청소년
--   고급반은 '매월 둘째·넷째 주'라 캘린더에 실제로 없는 수업이 매달 4건씩 떴다.
--   운영진은 schedule_ko(자유 텍스트)에 "둘째·넷째 주"라고 고쳐 적었지만 캘린더는
--   그 글자를 읽지 않는다 — 사람이 아는 것을 시스템이 표현할 수 없던 자리다.
--
--   week_ordinals: 쉼표구분 주차(1~5). 예 "2,4"=매월 둘째·넷째 주. 비우면 매주(종전 동작).
--     주차 계산은 '그 달 며칠인가'로 정한다 — 1~7일=1주, 8~14일=2주 … (JS와 동일).
--     '14일 간격'이 아니라 '몇 째 주'인 이유: 원장님이 "3주차, 4주차"로 말한다.
--     14일 간격은 일요일이 5번인 달에서 학원 달력과 어긋나기 시작한다.
--
--   skip_dates / extra_dates: 쉼표구분 'YYYY-MM-DD'. 규칙이 흔들리는 달을 위한 예외다.
--     "이번 달만 3·4주" = 둘째 주를 skip + 셋째 주를 extra. 휴강·보강도 같은 장치를 쓴다.
--     판정 순서는 lib/programSchedule.ts의 classMeetsOn 하나에만 있다.
-- Apply: npm run d1:migrate migrations/0043_program_week_ordinals.sql
--   (ALTER ADD COLUMN 재실행 시 "duplicate column name"은 러너가 SKIP 처리 — 멱등)

ALTER TABLE programs ADD COLUMN week_ordinals TEXT;
ALTER TABLE programs ADD COLUMN skip_dates TEXT;
ALTER TABLE programs ADD COLUMN extra_dates TEXT;

-- 이미 알고 있는 격주 수업 4개를 바로잡는다(선생님 확인 2026-09-02).
--   17 청소년 한국전통무용 고급작품반 — 매월 둘째·넷째 토요일, 하루 45분×2회(=월 4회)
--   19·20·21 성인반 3과목        — 매월 둘째·넷째 일요일, 각 45분 + 15분 휴식
-- 같은 값을 다시 써도 결과가 같다(재실행 안전).
UPDATE programs SET week_ordinals = '2,4' WHERE id IN (17, 19, 20, 21);
