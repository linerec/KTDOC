/**
 * Comments D1 Database Queries
 * 수업·이벤트 댓글·대댓글. user_id는 MySQL users.id(UUID) — 이름/사진은 호출부에서 결합.
 */

import { queryD1, executeD1 } from './client';
import type {
  Comment,
  CommentTargetType,
  CreateCommentInput,
} from '@/types/comments';

/** 특정 대상의 댓글 전체(최상위 + 대댓글)를 시간순으로 반환. 스레드 조립은 호출부/표시에서. */
export async function getComments(
  targetType: CommentTargetType,
  targetId: number
): Promise<Comment[]> {
  return queryD1<Comment>(
    `SELECT * FROM comments
     WHERE target_type = ? AND target_id = ?
     ORDER BY created_at ASC, id ASC`,
    [targetType, targetId]
  );
}

export async function getCommentById(id: number): Promise<Comment | null> {
  const rows = await queryD1<Comment>('SELECT * FROM comments WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function createComment(input: CreateCommentInput): Promise<number> {
  const { lastRowId } = await executeD1(
    `INSERT INTO comments (target_type, target_id, parent_id, user_id, body, is_announcement)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.target_type,
      input.target_id,
      input.parent_id ?? null,
      input.user_id,
      input.body,
      input.is_announcement ? 1 : 0,
    ]
  );
  return lastRowId;
}

/** 댓글 삭제. 최상위 댓글이면 대댓글도 FK CASCADE로 함께 삭제된다. */
export async function deleteComment(id: number): Promise<void> {
  await executeD1('DELETE FROM comments WHERE id = ?', [id]);
}

/** 특정 대상 댓글 수(대댓글 포함). 상세 목록 배지 등. */
export async function countComments(
  targetType: CommentTargetType,
  targetId: number
): Promise<number> {
  const rows = await queryD1<{ count: number }>(
    'SELECT COUNT(*) as count FROM comments WHERE target_type = ? AND target_id = ?',
    [targetType, targetId]
  );
  return rows[0]?.count || 0;
}
