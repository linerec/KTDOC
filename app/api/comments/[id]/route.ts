/**
 * Comment Detail API
 * DELETE /api/comments/[id] - 댓글 삭제 (본인 또는 운영진). 최상위면 대댓글도 함께 삭제.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff, isApproved } from '@/lib/isAdmin';
import { getCommentById, deleteComment } from '@/lib/d1';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id || !isApproved(session)) {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const commentId = parseInt(id);
    if (isNaN(commentId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const comment = await getCommentById(commentId);
    if (!comment) {
      return NextResponse.json({ success: false, error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 본인 댓글이거나 운영진만 삭제 가능
    if (comment.user_id !== session.user.id && !isStaff(session)) {
      return NextResponse.json({ success: false, error: '삭제 권한이 없습니다.' }, { status: 403 });
    }

    await deleteComment(commentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Comment delete error:', error);
    return NextResponse.json({ success: false, error: '댓글 삭제에 실패했습니다.' }, { status: 500 });
  }
}
