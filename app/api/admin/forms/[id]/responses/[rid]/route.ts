/**
 * Admin 응답 상세 API
 * PATCH /api/admin/forms/[id]/responses/[rid] — 상태 변경 · 메모 추가
 *
 * 상태 전이에 규칙을 두지 않는다. 기존 applications 의 진짜 문제는 자유 전이가
 * 아니라 **무기록**이었다 — 누가 언제 무엇에서 무엇으로 옮겼는지 남지 않았다.
 * 전이는 자유롭게 두고 전부 form_response_notes 에 남긴다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { addResponseNote, getResponseById, updateResponseStatus } from '@/lib/d1';
import type { ResponseStatus } from '@/types/forms';

const STATUSES: ResponseStatus[] = [
  'new',
  'reviewing',
  'needs_info',
  'accepted',
  'enrolled',
  'declined',
  'cancelled',
];

interface RouteParams {
  params: Promise<{ id: string; rid: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { rid } = await params;
    const responseId = Number(rid);
    if (!Number.isInteger(responseId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const existing = await getResponseById(responseId);
    if (!existing) {
      return NextResponse.json({ success: false, error: '응답을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const status = typeof body.status === 'string' ? (body.status as ResponseStatus) : null;
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!status && !note) {
      return NextResponse.json({ success: false, error: '바뀐 것이 없습니다.' }, { status: 400 });
    }
    if (status && !STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: '알 수 없는 상태입니다.' }, { status: 400 });
    }

    const authorId = session?.user?.id ?? null;
    const authorName = session?.user?.name ?? null;

    if (status && status !== existing.status) {
      await updateResponseStatus(responseId, status, authorId);
      await addResponseNote({
        responseId,
        kind: 'status',
        fromStatus: existing.status,
        toStatus: status,
        body: note || null,
        authorId,
        authorName,
      });
    } else if (note) {
      await addResponseNote({ responseId, kind: 'note', body: note, authorId, authorName });
    }

    return NextResponse.json({ success: true, data: { id: responseId } });
  } catch (error) {
    console.error('Admin form response update error:', error);
    return NextResponse.json({ success: false, error: '저장하지 못했습니다.' }, { status: 500 });
  }
}
