/**
 * Admin FAQ Detail API
 * PUT    /api/admin/faq/[id] - Q&A 수정
 * DELETE /api/admin/faq/[id] - Q&A 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { getFaqItemById, updateFaqItem, deleteFaqItem, eventIdExists } from '@/lib/d1';
import type { UpdateFaqInput } from '@/types/faq';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'faq'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const faqId = parseInt(id);
    if (isNaN(faqId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const existing = await getFaqItemById(faqId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Q&A를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (body.question !== undefined && !body.question?.trim()) {
      return NextResponse.json(
        { success: false, error: '질문은 비울 수 없습니다.' },
        { status: 400 }
      );
    }
    if (body.answer !== undefined && !body.answer?.trim()) {
      return NextResponse.json(
        { success: false, error: '답변은 비울 수 없습니다.' },
        { status: 400 }
      );
    }
    if (body.event_id !== undefined && body.event_id !== null) {
      if (typeof body.event_id !== 'number' || !(await eventIdExists(body.event_id))) {
        return NextResponse.json(
          { success: false, error: '연결할 이벤트를 찾을 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    const input: UpdateFaqInput = {};
    if (body.event_id !== undefined) input.event_id = body.event_id;
    if (body.question !== undefined) input.question = body.question.trim();
    if (body.answer !== undefined) input.answer = body.answer.trim();
    if (body.sort_order !== undefined) input.sort_order = Number(body.sort_order) || 0;
    if (body.is_published !== undefined) input.is_published = body.is_published;

    await updateFaqItem(faqId, input);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin faq update error:', error);
    return NextResponse.json(
      { success: false, error: 'Q&A 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'faq'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const faqId = parseInt(id);
    if (isNaN(faqId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const existing = await getFaqItemById(faqId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Q&A를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await deleteFaqItem(faqId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin faq delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Q&A 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
