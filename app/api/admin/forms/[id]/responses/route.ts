/**
 * POST /api/admin/forms/[id]/responses — 대리 입력
 *
 * 카톡·전화·종이로 온 신청을 운영진이 대신 넣는다. 학기 초 업무의 절반이 이것이다.
 * 공개 제출과 같은 검증을 통과시키되 두 가지가 다르다:
 *   - source='staff' 로 남긴다(누가 낸 것인지 나중에 구분해야 한다)
 *   - 이메일을 받지 못한 신청도 있으므로 이메일 필수 검증에 걸리지 않게
 *     **화면에서 비워 두면 그대로 저장한다** — 대신 연락처를 받는다.
 *
 * 마감된 신청서에도 넣을 수 있다. 마감 뒤에 전화로 오는 신청이 실제로 있다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { addResponseNote, getFormById, insertResponse } from '@/lib/d1';
import { validateAnswers, visibleQuestions } from '@/lib/forms/schema';
import type { Answers, FormSchema } from '@/types/forms';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
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

    const body = await request.json();
    const rawAnswers = (body.answers ?? {}) as Answers;

    const schema = JSON.parse(form.schema_json) as FormSchema;
    const keep = new Set(visibleQuestions(schema, rawAnswers).map((q) => q.key));
    const answers: Answers = Object.fromEntries(
      Object.entries(rawAnswers).filter(([k]) => keep.has(k))
    );

    // 대리 입력에서는 이메일을 비울 수 있다 — 전화로 받은 신청에는 이메일이 없다.
    const emailKeys = visibleQuestions(schema, answers)
      .filter((q) => q.bind === 'email')
      .map((q) => q.key);

    const fieldErrors = validateAnswers(schema, answers);
    for (const k of emailKeys) {
      const v = answers[k];
      if (!v || (typeof v === 'string' && !v.trim())) delete fieldErrors[k];
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { success: false, error: '입력하지 않은 항목이 있습니다.', fieldErrors },
        { status: 400 }
      );
    }

    const responseId = await insertResponse({
      formId: form.id,
      formTitleKo: form.title_ko,
      schemaVersion: form.schema_version,
      season: form.season,
      locale: 'ko',
      schema,
      answers,
      submittedByUserId: null,
      studentUserId: null,
      linkSource: null,
      source: 'staff',
      metaJson: null,
      submitIpHash: null,
    });

    await addResponseNote({
      responseId,
      kind: 'note',
      body: `${session?.user?.name ?? '운영진'}이(가) 대신 입력했습니다.`,
      authorId: session?.user?.id ?? null,
      authorName: session?.user?.name ?? null,
    });

    return NextResponse.json({ success: true, data: { responseId } });
  } catch (error) {
    console.error('Admin form staff entry error:', error);
    return NextResponse.json({ success: false, error: '저장하지 못했습니다.' }, { status: 500 });
  }
}
