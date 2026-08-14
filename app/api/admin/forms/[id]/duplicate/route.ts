/**
 * POST /api/admin/forms/[id]/duplicate — 연차 복제 (요구 R2.1)
 *
 * 작년 신청서를 통째로 복사해 새 초안을 만든다. 문안은 schema_json 컬럼 하나를
 * 옮기면 끝난다 — 문항을 정규화 테이블로 쪼갰다면 여기가 행 N+M개 복사가 됐을 것이다.
 * 새 신청서는 항상 초안(draft)이고 응답은 딸려오지 않는다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { duplicateForm, getFormById, slugExists } from '@/lib/d1';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const sourceId = Number(id);
    if (!Number.isInteger(sourceId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const source = await getFormById(sourceId);
    if (!source) {
      return NextResponse.json(
        { success: false, error: '복제할 신청서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    const titleKo = typeof body.title_ko === 'string' ? body.title_ko.trim() : '';
    const season = typeof body.season === 'string' && body.season.trim() ? body.season.trim() : null;

    if (!SLUG_RE.test(slug)) {
      return NextResponse.json(
        { success: false, error: '주소는 소문자·숫자·하이픈만 쓸 수 있습니다.' },
        { status: 400 }
      );
    }
    if (!titleKo) {
      return NextResponse.json({ success: false, error: '제목은 필수입니다.' }, { status: 400 });
    }
    if (await slugExists(slug)) {
      return NextResponse.json({ success: false, error: '이미 쓰이는 주소입니다.' }, { status: 400 });
    }

    const newId = await duplicateForm(sourceId, {
      slug,
      season,
      title_ko: titleKo,
      createdBy: session?.user?.id ?? null,
    });

    return NextResponse.json({ success: true, data: { id: newId } });
  } catch (error) {
    console.error('Admin form duplicate error:', error);
    return NextResponse.json({ success: false, error: '복제에 실패했습니다.' }, { status: 500 });
  }
}
