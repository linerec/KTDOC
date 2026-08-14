/**
 * 공개 신청서 제출
 * POST /api/forms/[slug]/submit
 *
 * 순서가 중요하다:
 *   1) 스팸 3종 (허니팟 / 최소 체류시간 / 본문 크기)
 *   2) 폼 상태·접수기간을 **서버에서 재확인** — 화면이 열려 있던 동안 마감됐을 수 있다
 *   3) requires_login 확인 (클라이언트를 믿지 않는다)
 *   4) 화면에서 사라진 문항의 답을 버리고 validateAnswers — 클라이언트 검증은 편의일 뿐이다
 *   5) insertResponse (본체 단일 INSERT + 파생)
 *   6) 운영진 통지 (실패해도 제출을 되돌리지 않는다)
 *
 * 미들웨어가 /api 를 타지 않으므로 이 라우트가 스스로 auth() 를 부른다.
 * 클라이언트가 보낸 user_id 는 절대 신뢰하지 않는다 — 세션에서만 읽는다.
 */

import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOpenFormBySlug, insertResponse } from '@/lib/d1';
import { validateAnswers, visibleQuestions } from '@/lib/forms/schema';
import { notifyStaffOfFormResponse } from '@/lib/push/system';
import type { Answers, FormSchema, LinkSource } from '@/types/forms';

/** 열자마자 제출되는 것은 사람이 아니다(app/api/applications 관용구 승계). */
const MIN_SUBMIT_MS = 2000;
/** 답변 JSON 상한 — 장문 문항이 있어도 이보다 클 이유가 없다. */
const MAX_ANSWERS_BYTES = 64 * 1024;

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const body = await request.json();

    // ── 1) 스팸 3종
    // 허니팟에 걸리면 조용히 성공으로 답한다 — 봇에게 무엇이 걸렸는지 알려주지 않는다.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ success: true, data: { responseId: 0 } });
    }
    const renderedAt = Number(body.renderedAt);
    if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < MIN_SUBMIT_MS) {
      return NextResponse.json(
        { success: false, error: '잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    const rawAnswers = (body.answers ?? {}) as Answers;
    if (JSON.stringify(rawAnswers).length > MAX_ANSWERS_BYTES) {
      return NextResponse.json(
        { success: false, error: '입력이 너무 깁니다. 내용을 줄여 주세요.' },
        { status: 413 }
      );
    }

    // ── 2) 폼 상태를 서버에서 다시 본다
    const form = await getOpenFormBySlug(slug);
    if (!form) {
      return NextResponse.json(
        { success: false, error: '접수가 마감되었거나 없는 신청서입니다.' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (form.opens_at && now < form.opens_at) {
      return NextResponse.json(
        { success: false, error: '아직 접수가 시작되지 않았습니다.' },
        { status: 400 }
      );
    }
    if (form.closes_at && now > form.closes_at) {
      return NextResponse.json({ success: false, error: '접수가 마감되었습니다.' }, { status: 400 });
    }

    // ── 3) 로그인 요구
    const session = await auth();
    if (form.requires_login && !session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인 후 작성하실 수 있습니다.' },
        { status: 401 }
      );
    }

    // ── 4) 검증. 화면에서 사라진 문항의 답은 버린다.
    const schema = JSON.parse(form.schema_json) as FormSchema;
    const keep = new Set(visibleQuestions(schema, rawAnswers).map((q) => q.key));
    const answers: Answers = Object.fromEntries(
      Object.entries(rawAnswers).filter(([k]) => keep.has(k))
    );

    const fieldErrors = validateAnswers(schema, answers);
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { success: false, error: '입력하지 않은 항목이 있습니다.', fieldErrors },
        { status: 400 }
      );
    }

    // ── 5) 저장. 원문 IP 는 남기지 않는다.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const submitIpHash = ip
      ? createHash('sha256').update(ip).digest('hex').slice(0, 16)
      : null;

    const userId = session?.user?.id ?? null;
    const linkSource: LinkSource | null = userId ? 'session' : null;
    // 학생 본인이 로그인해 낸 경우에만 대상 학생을 정한다.
    // 학부모 계정이면 자녀가 누구인지 모르므로 비워 두고 운영진이 연결한다 —
    // 여기서 학부모를 넣으면 나중에 학부모가 수업에 배정된다.
    const studentUserId = session?.user?.role === 'student' ? userId : null;

    const responseId = await insertResponse({
      formId: form.id,
      formTitleKo: form.title_ko,
      schemaVersion: form.schema_version,
      season: form.season,
      locale: body.locale === 'en' ? 'en' : 'ko',
      schema,
      answers,
      submittedByUserId: userId,
      studentUserId,
      linkSource,
      source: 'public',
      metaJson: null,
      submitIpHash,
    });

    // ── 6) 통지. 실패해도 접수를 되돌리지 않는다.
    try {
      const nameKey = visibleQuestions(schema, answers).find((q) => q.bind === 'student_name')?.key;
      const named = nameKey ? answers[nameKey] : null;
      await notifyStaffOfFormResponse({
        formId: form.id,
        formTitle: form.title_ko,
        studentName: typeof named === 'string' && named.trim() ? named.trim() : '이름 미상',
      });
    } catch (error) {
      console.error('form response notify failed:', error);
    }

    return NextResponse.json({ success: true, data: { responseId } });
  } catch (error) {
    console.error('Form submit error:', error);
    return NextResponse.json(
      { success: false, error: '제출에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
