/**
 * POST   /api/admin/forms/[id]/trial — 임시 게시 시작 (draft → trial)
 * DELETE /api/admin/forms/[id]/trial — 임시 게시 해제 (trial → draft)
 *
 * 임시 게시는 **저장하지 않는 공개**다. 링크를 아는 누구나 열어 끝까지 작성해 볼 수
 * 있지만 제출해도 아무것도 남지 않는다. 원장·관계자가 계정 없이 진짜 화면을
 * 확인하는 자리다.
 *
 * 저장하지 않으므로 **구조도 잠기지 않는다** — 보고 나서 과목을 고칠 수 있다.
 * 그것이 '게시하기'와 갈리는 지점이고, 임시 게시가 존재하는 이유다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { endTrial, getFormById, startTrial } from '@/lib/d1';
import { validateSchema } from '@/lib/forms/schema';
import type { FormSchema } from '@/types/forms';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function guard(params: RouteParams['params']) {
  const session = await auth();
  if (!(await hasMenuAccess(session, 'forms'))) {
    return {
      error: NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 }),
    };
  }
  const { id } = await params;
  const formId = Number(id);
  if (!Number.isInteger(formId)) {
    return {
      error: NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 }),
    };
  }
  const form = await getFormById(formId);
  if (!form) {
    return {
      error: NextResponse.json({ success: false, error: '신청서를 찾을 수 없습니다.' }, { status: 404 }),
    };
  }
  return { formId, form };
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const g = await guard(params);
    if (g.error) return g.error;
    const { formId, form } = g;

    if (form.status === 'open' || form.status === 'closed') {
      return NextResponse.json(
        {
          success: false,
          error: '이미 접수를 연 신청서는 임시 게시로 되돌릴 수 없습니다. 실제 응답이 있을 수 있습니다.',
        },
        { status: 400 }
      );
    }

    // 문안이 깨진 채로 남에게 보여주지 않는다 — 게시와 같은 게이트를 통과시킨다.
    const errors = validateSchema(JSON.parse(form.schema_json) as FormSchema);
    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: `문안에 고칠 것이 있습니다 — ${errors.join(' / ')}` },
        { status: 400 }
      );
    }

    await startTrial(formId);
    return NextResponse.json({ success: true, data: { slug: form.slug } });
  } catch (error) {
    console.error('Admin form trial error:', error);
    return NextResponse.json({ success: false, error: '임시 게시에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const g = await guard(params);
    if (g.error) return g.error;
    const { formId, form } = g;

    if (form.status !== 'trial') {
      return NextResponse.json(
        { success: false, error: '임시 게시 상태가 아닙니다.' },
        { status: 400 }
      );
    }

    await endTrial(formId);
    return NextResponse.json({ success: true, data: { id: formId } });
  } catch (error) {
    console.error('Admin form untrial error:', error);
    return NextResponse.json({ success: false, error: '해제하지 못했습니다.' }, { status: 500 });
  }
}
