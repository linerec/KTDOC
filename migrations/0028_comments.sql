-- migrations/0028_comments.sql
-- 수업(program)·이벤트(event) 상세의 회원 댓글·대댓글 + 선생님 공지
-- 콘텐츠는 D1(SQLite), 회원(user_id)은 MySQL users.id(UUID) — 교차 저장소라 user FK 없음.
-- SQLite dialect (Cloudflare D1). Apply with:
--   node scripts/d1Migrate.mjs migrations/0028_comments.sql

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('program', 'event')),
  target_id INTEGER NOT NULL,
  -- 대댓글: 최상위 댓글의 id. 최상위 댓글은 NULL. (1단계 중첩만)
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,                 -- MySQL users.id (UUID). FK 없음.
  body TEXT NOT NULL,
  is_announcement INTEGER NOT NULL DEFAULT 0,  -- 선생님·관리자 공지(상단 강조)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
