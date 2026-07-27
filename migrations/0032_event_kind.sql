-- 0032: 이벤트 종류 축(공연 / 학내 행사)
--
-- events.category_id는 "어떤 공연인가"(경연대회·축제·기업행사…) 축이므로
-- 여기에 '수료식'을 섞지 않는다. kind는 그와 직교하는 별도 축이다.
-- 기존 전 건은 DEFAULT로 'performance'가 되므로 데이터 이관 작업이 없다.
--
-- 값: 'performance' = 대외 공연, 'school' = 수료식·발표회 등 학내 행사
-- CHECK 제약을 걸지 않는 이유: 종류가 늘 때 마이그레이션 없이 값만 추가할 수 있게.
-- (news_posts.category와 같은 방식 — 검증은 API 계층에서 한다)

ALTER TABLE events ADD COLUMN kind TEXT NOT NULL DEFAULT 'performance';

CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
