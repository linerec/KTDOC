/**
 * POST /api/admin/forms/[id]/responses — 대리 입력
 *
 * 카톡·전화·종이로 온 신청을 운영진이 대신 넣는다. 학기 초 업무의 절반이 이것이다.
 * 공개 제출과 같은 검증을 통과시키되 세 가지가 다르다:
 *   - source='staff' 로 남긴다(누가 낸 것인지 나중에 구분해야 한다)
 *   - 이메일을 받지 못한 신청도 있으므로 이메일 필수 검증에 걸리지 않게
 *     **화면에서 비워 두면 그대로 저장한다** — 대신 연락처를 받는다
 *   - 누구의 신청인지 **넣는 자리에서 바로 잇는다**(studentUserId). 전화를 받은
 *     사람이 그 자리에서 아는 것을, 나중에 상세 화면에서 다시 찾게 하지 않는다
 *
 * 마감된 신청서에도 넣을 수 있다. 마감 뒤에 전화로 오는 신청이 실제로 있다.
 *
 * 스팸 3종(허니팟·체류시간·본문 크기)은 걸지 않는다 — 로그인한 운영진이고,
 * 종이 신청서를 보고 옮겨 적느라 오래 걸리는 것이 정상이다. 크기만 지킨다.
 *
 * ──────────────────────────────────────────────────────────────────
 * **쌍둥이가 있다: app/api/forms/[slug]/submit (공개 제출).**
 *
 * 저 쪽에 제출 이후 단계가 늘면(확인 메일·통지·자동 계산 같은 것) 그것이 전화로
 * 받은 신청에도 필요한 일인지 여기서 판단해야 한다. 문항이 늘거나 바뀌는 것은
 * 둘 다 같은 스키마를 보므로 저절로 따라온다 — 갈라지는 것은 **단계**뿐이다.
 * ──────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { addResponseNote, getFormById, insertResponse } from '@/lib/d1';
import { validateAnswers, visibleQuestions } from '@/lib/forms/schema';
import {
  ENTRY_MEMO_MAX,
  isEntryChannel,
  isOptionalInStaffEntry,
  staffEntryNote,
} from '@/lib/forms/staffEntry';
import { getMemberById } from '@/lib/members';
import type { Answers, FormSchema, LinkSource } from '@/types/forms';

/** 답변 JSON 상한 — 공개 제출과 같은 값. 장문 문항이 있어도 이보다 클 이유가 없다. */
const MAX_ANSWERS_BYTES = 64 * 1024;

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
    if (JSON.stringify(rawAnswers).length > MAX_ANSWERS_BYTES) {
      return NextResponse.json(
        { success: false, code: 'tooLong', error: '입력이 너무 깁니다. 내용을 줄여 주세요.' },
        { status: 413 }
      );
    }

    const schema = JSON.parse(form.schema_json) as FormSchema;
    const keep = new Set(visibleQuestions(schema, rawAnswers).map((q) => q.key));
    const answers: Answers = Object.fromEntries(
      Object.entries(rawAnswers).filter(([k]) => keep.has(k))
    );

    // 대리 입력에서는 이메일을 비울 수 있다 — 전화로 받은 신청에는 이메일이 없다.
    // 화면(relaxSchemaForStaffEntry)이 별표를 떼는 문항과 **같은 규칙**을 본다.
    const relaxedKeys = visibleQuestions(schema, answers)
      .filter(isOptionalInStaffEntry)
      .map((q) => q.key);

    const fieldErrors = validateAnswers(schema, answers);
    for (const k of relaxedKeys) {
      const v = answers[k];
      if (!v || (typeof v === 'string' && !v.trim())) delete fieldErrors[k];
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { success: false, code: 'fieldErrors', error: '입력하지 않은 항목이 있습니다.', fieldErrors },
        { status: 400 }
      );
    }

    // ── 누구의 신청인가.
    //    화면이 보낸 id 를 그대로 믿지 않고 회원을 조회해 존재를 확인한다.
    //    없는 회원이면 **접수는 살리고 연결만 포기한다** — 옮겨 적은 답변을
    //    되돌려 보내는 쪽이 훨씬 나쁘다. 연결은 상세 화면에서 다시 할 수 있다.
    const askedUserId = typeof body.studentUserId === 'string' ? body.studentUserId.trim() : '';
    const linkedMember = askedUserId ? await getMemberById(askedUserId) : null;
    const studentUserId = linkedMember?.id ?? null;
    // 운영진이 눈으로 보고 고른 연결이다 — 이메일이 같아서 이어붙인 것이 아니다.
    const linkSource: LinkSource | null = studentUserId ? 'manual' : null;

    // ── 어디로 받았는가. 모르는 값은 조용히 버린다(기록이 틀리느니 없는 편이 낫다).
    const channel = isEntryChannel(body.channel) ? body.channel : null;
    const memo =
      typeof body.memo === 'string' ? body.memo.trim().slice(0, ENTRY_MEMO_MAX) : '';

    const staffName = session?.user?.name ?? '운영진';

    const responseId = await insertResponse({
      formId: form.id,
      formTitleKo: form.title_ko,
      schemaVersion: form.schema_version,
      season: form.season,
      locale: 'ko',
      schema,
      answers,
      // 낸 사람은 운영진이 아니다 — 대신 적었을 뿐이라 제출자는 비워 둔다.
      // 누가 적었는지는 아래 처리 이력이 이름으로 남긴다.
      submittedByUserId: null,
      studentUserId,
      linkSource,
      source: 'staff',
      metaJson: JSON.stringify({
        staffEntry: {
          by: session?.user?.id ?? null,
          byName: staffName,
          channel,
          memo: memo || null,
        },
      }),
      submitIpHash: null,
    });

    await addResponseNote({
      responseId,
      kind: 'note',
      body: staffEntryNote({ staffName, channel, memo }),
      authorId: session?.user?.id ?? null,
      authorName: session?.user?.name ?? null,
      // 자동으로 쓴 문장이라 사람이 남긴 운영 메모를 덮지 않는다.
      system: true,
    });

    // 연결까지 했으면 이력에 따로 한 줄 — 상세에서 연결했을 때와 같은 모양으로 남는다.
    if (linkedMember) {
      await addResponseNote({
        responseId,
        kind: 'link',
        body: `${linkedMember.name ?? linkedMember.email} 회원과 연결했습니다.`,
        authorId: session?.user?.id ?? null,
        authorName: session?.user?.name ?? null,
        system: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: { responseId, linked: studentUserId !== null, linkRequested: askedUserId !== '' },
    });
  } catch (error) {
    console.error('Admin form staff entry error:', error);
    return NextResponse.json(
      { success: false, code: 'serverError', error: '저장하지 못했습니다.' },
      { status: 500 }
    );
  }
}
