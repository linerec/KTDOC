/**
 * POST /api/admin/forms/[id]/responses/[rid]/reveal — 민감 문항 열람
 *
 * 의료정보(알레르기·건강상태)는 목록과 기본 내보내기에서 빠져 있고, 상세에서
 * 펼쳐야 보인다. 펼치는 순간 **누가 언제 열었는지 남긴다**.
 *
 * 완벽한 통제는 아니다 — 열람 권한 자체는 이미 있는 사람이다. 다만 "샜는지조차
 * 모르는" 상태는 피한다. 미성년자 의료정보를 다루는 화면의 최소선이다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { getResponseById, recordSensitiveView } from '@/lib/d1';
import { getSchemaVersion } from '@/lib/d1';
import { allQuestions } from '@/lib/forms/schema';
import type { Answers } from '@/types/forms';

interface RouteParams {
  params: Promise<{ id: string; rid: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }
    const viewerId = session?.user?.id;
    if (!viewerId) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { rid } = await params;
    const responseId = Number(rid);
    if (!Number.isInteger(responseId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const response = await getResponseById(responseId);
    if (!response) {
      return NextResponse.json({ success: false, error: '응답을 찾을 수 없습니다.' }, { status: 404 });
    }

    await recordSensitiveView({
      responseId,
      viewerId,
      viewerName: session?.user?.name ?? null,
      context: 'detail',
    });

    // 그 응답이 본 문안 버전으로 민감 문항을 찾는다 — 지금 스키마로 찾으면
    // 이후 바뀐 문항을 놓칠 수 있다.
    const schema = await getSchemaVersion(response.form_id, response.form_schema_version);
    const answers = JSON.parse(response.answers_json) as Answers;
    const items = schema
      ? allQuestions(schema)
          .filter((q) => q.sensitive)
          .map((q) => ({
            key: q.key,
            label: q.label.ko,
            value: typeof answers[q.key] === 'string' ? (answers[q.key] as string) : '',
          }))
          .filter((x) => x.value.trim())
      : [];

    return NextResponse.json({ success: true, data: { items } });
  } catch (error) {
    console.error('Admin form reveal error:', error);
    return NextResponse.json({ success: false, error: '열람하지 못했습니다.' }, { status: 500 });
  }
}
