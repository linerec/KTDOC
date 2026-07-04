/**
 * 댓글 스레드 조립(서버) — D1 댓글 + MySQL 회원(이름·사진)을 결합해
 * 최상위 댓글 + 대댓글(1단계) 구조로 만든다. 공지는 상단에 온다.
 */

import { getComments } from '@/lib/d1';
import { getUserProfilesByIds } from '@/lib/members';
import type { CommentTargetType, CommentThread, CommentWithAuthor } from '@/types/comments';

export async function getCommentThreads(
  targetType: CommentTargetType,
  targetId: number
): Promise<CommentThread[]> {
  const comments = await getComments(targetType, targetId);
  if (comments.length === 0) return [];

  const profiles = await getUserProfilesByIds(comments.map((c) => c.user_id));
  const withAuthor: CommentWithAuthor[] = comments.map((c) => {
    const p = profiles.get(c.user_id);
    return { ...c, author_name: p?.name ?? null, author_photo: p?.photo ?? null };
  });

  const repliesByParent = new Map<number, CommentWithAuthor[]>();
  for (const c of withAuthor) {
    if (c.parent_id != null) {
      const list = repliesByParent.get(c.parent_id) ?? [];
      list.push(c);
      repliesByParent.set(c.parent_id, list);
    }
  }

  const threads: CommentThread[] = withAuthor
    .filter((c) => c.parent_id == null)
    .map((c) => ({ ...c, replies: repliesByParent.get(c.id) ?? [] }));

  // 공지 먼저, 그다음 오래된→최신
  threads.sort(
    (a, b) => b.is_announcement - a.is_announcement || a.created_at.localeCompare(b.created_at)
  );
  return threads;
}
