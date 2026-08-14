/**
 * POST /api/admin/forms/[id]/publish — 신청서 게시 (draft → open)
 *
 * 게시하면 공개 주소 /f/{slug} 가 열린다. 게이트를 통과하지 못하는 문안은 게시하지
 * 않는다 — 차단 사유를 그대로 돌려주어 운영자가 무엇을 고쳐야 하는지 보게 한다.
 * 경고(수업 미연결 등)는 막지 않는다. 설문처럼 수업 연결이 필요 없는 폼도 있다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { getFormById, publishForm } from '@/lib/d1';
import { validateSchema } from '@/lib/forms/schema';
import type { FormSchema } from '@/types/forms';

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
    if (form.status === 'open') {
      return NextResponse.json({ success: false, error: '이미 접수 중인 신청서입니다.' }, { status: 400 });
    }

    const errors = validateSchema(JSON.parse(form.schema_json) as FormSchema);
    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: `문안에 고칠 것이 있습니다 — ${errors.join(' / ')}` },
        { status: 400 }
      );
    }

    await publishForm(formId);
    return NextResponse.json({ success: true, data: { slug: form.slug } });
  } catch (error) {
    console.error('Admin form publish error:', error);
    return NextResponse.json({ success: false, error: '게시에 실패했습니다.' }, { status: 500 });
  }
}
