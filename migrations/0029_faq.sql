-- Migration: Q&A (자주 묻는 질문) — faq_items
-- Target DB: Cloudflare D1 (SQLite)
-- Description:
--   공연·행사 전에 선생님이 자주 묻는 질문과 답변을 미리 등록해 두면,
--   원생·학부모가 관리 콘솔 'Q&A' 메뉴에서 질문하지 않고도 중요한 정보를 확인한다.
--   - event_id: 특정 이벤트(공연·행사)에 연결. NULL = 공통 Q&A(모든 공연에 해당하는 안내).
--     이벤트 삭제 시 연결된 Q&A도 함께 정리(ON DELETE CASCADE — 갤러리 하위 테이블과 동일 규칙).
--   - question/answer: 관리 콘솔 전용 콘텐츠라 한국어 단일 컬럼(콘솔은 한국어 전용).
--   - sort_order: 그룹 내 표시 순서(작을수록 먼저).
--   - is_published: 1이면 'Q&A' 보기 메뉴에 노출. 작성 즉시 공개가 기본.
--   - created_by: 작성자 표시명(MySQL users와 교차 저장소라 FK 없이 문자열 보관).
-- Apply: npm run d1:migrate migrations/0029_faq.sql

CREATE TABLE IF NOT EXISTS faq_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_faq_items_event ON faq_items(event_id, is_published, sort_order);
