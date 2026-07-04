/**
 * Comments API
 * POST /api/comments - 댓글/대댓글 작성 (승인 회원). 작성 후 관련 회원에게 알림.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isApproved, isStaff } from '@/lib/isAdmin';
import { createComment, getCommentById } from '@/lib/d1';
import { notifyNewComment } from '@/lib/comments/notify';
import type { CommentTargetType } from '@/types/comments';

const TARGET_TYPES: CommentTargetType[] = ['program', 'event'];
const MAX_BODY = 2000;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !isApproved(session)) {
      return NextResponse.json(
        { success: false, error: '로그인한 정회원만 작성할 수 있습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const targetType = body.target_type as CommentTargetType;
    const targetId = Number(body.target_id);
    const text = typeof body.body === 'string' ? body.body.trim() : '';

    if (!TARGET_TYPES.includes(targetType) || !Number.isFinite(targetId)) {
      return NextResponse.json({ success: false, error: '대상이 올바르지 않습니다.' }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ success: false, error: '내용을 입력하세요.' }, { status: 400 });
    }
    if (text.length > MAX_BODY) {
      return NextResponse.json({ success: false, error: '내용이 너무 깁니다.' }, { status: 400 });
    }

    // 대댓글: 부모가 있어야 하고, 부모가 이미 대댓글이면 그 최상위로 붙인다(1단계 유지).
    let parentId: number | null = null;
    let parentAuthorId: string | null = null;
    if (body.parent_id != null) {
      const parent = await getCommentById(Number(body.parent_id));
      if (!parent || parent.target_type !== targetType || parent.target_id !== targetId) {
        return NextResponse.json({ success: false, error: '원 댓글을 찾을 수 없습니다.' }, { status: 400 });
      }
      parentId = parent.parent_id ?? parent.id;
      parentAuthorId = parent.user_id;
    }

    // 공지는 운영진(선생님·관리자)만
    const isAnnouncement = !!body.is_announcement && isStaff(session);

    const id = await createComment({
      target_type: targetType,
      target_id: targetId,
      parent_id: parentId,
      user_id: session.user.id,
      body: text,
      is_announcement: isAnnouncement,
    });

    // 알림(실패해도 작성은 성공 처리)
    try {
      await notifyNewComment({
        targetType,
        targetId,
        authorId: session.user.id,
        authorName: session.user.name || '회원',
        body: text,
        commentId: id,
        isAnnouncement,
        parentAuthorId,
      });
    } catch (e) {
      console.warn('notifyNewComment failed:', e);
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Comment create error:', error);
    return NextResponse.json({ success: false, error: '댓글 작성에 실패했습니다.' }, { status: 500 });
  }
}
