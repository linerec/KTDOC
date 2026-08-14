/**
 * POST /api/admin/forms/[id]/close — 접수 마감 (open → closed)
 *
 * 마감해도 응답은 그대로 남아 열람·내보내기가 계속 된다. 공개 주소만 닫힌다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { closeForm, getFormById } from '@/lib/d1';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const formId = Number(id);
    if (!Number.isInteger(formId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const form = await getFormById(formId);
    if (!form) {
      return NextResponse.json({ success: false, error: '신청서를 찾을 수 없습니다.' }, { status: 404 });
    }
    if (form.status !== 'open') {
      return NextResponse.json({ success: false, error: '접수 중인 신청서가 아닙니다.' }, { status: 400 });
    }

    await closeForm(formId);
    return NextResponse.json({ success: true, data: { id: formId } });
  } catch (error) {
    console.error('Admin form close error:', error);
    return NextResponse.json({ success: false, error: '마감에 실패했습니다.' }, { status: 500 });
  }
}
