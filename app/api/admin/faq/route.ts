/**
 * Admin FAQ API
 * GET  /api/admin/faq - Q&A 목록 (관리자·선생님, 비공개 포함)
 * POST /api/admin/faq - Q&A 생성
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { getFaqItems, createFaqItem, eventIdExists } from '@/lib/d1';
import type { CreateFaqInput } from '@/types/faq';

export async function GET() {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'faq'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const items = await getFaqItems({ published: 'all' });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('Admin faq fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Q&A 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'faq'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { event_id, question, answer, sort_order, is_published } = body;

    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json(
        { success: false, error: '질문과 답변은 필수입니다.' },
        { status: 400 }
      );
    }

    if (event_id !== undefined && event_id !== null) {
      if (typeof event_id !== 'number' || !(await eventIdExists(event_id))) {
        return NextResponse.json(
          { success: false, error: '연결할 이벤트를 찾을 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    const input: CreateFaqInput = {
      event_id: event_id ?? null,
      question: question.trim(),
      answer: answer.trim(),
      sort_order: Number(sort_order) || 0,
      is_published: is_published ?? true,
      created_by: session?.user?.name || null,
    };

    const faqId = await createFaqItem(input);

    return NextResponse.json({ success: true, data: { id: faqId } });
  } catch (error) {
    console.error('Admin faq create error:', error);
    return NextResponse.json(
      { success: false, error: 'Q&A 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
