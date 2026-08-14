/**
 * 공개 신청서 제출
 * POST /api/forms/[slug]/submit
 *
 * 순서가 중요하다:
 *   1) 스팸 3종 (허니팟 / 최소 체류시간 / 본문 크기)
 *   2) 폼 상태·접수기간을 **서버에서 재확인** — 화면이 열려 있던 동안 마감됐을 수 있다
 *   3) requires_login 확인 (클라이언트를 믿지 않는다)
 *   4) 화면에서 사라진 문항의 답을 버리고 validateAnswers — 클라이언트 검증은 편의일 뿐이다
 *   4.5) 임시 게시면 여기서 멈춘다 — 검증까지 겪게 하고 저장은 하지 않는다
 *   5) insertResponse (본체 단일 INSERT + 파생)
 *   6) 신청서 안에서의 회원가입 (선택) — 응답을 먼저 저장한 뒤에 만든다
 *   7) 운영진 통지 (실패해도 제출을 되돌리지 않는다)
 *
 * 미들웨어가 /api 를 타지 않으므로 이 라우트가 스스로 auth() 를 부른다.
 * 클라이언트가 보낸 user_id 는 절대 신뢰하지 않는다 — 세션에서만 읽는다.
 */

import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { attachSubmitter, getSubmittableFormBySlug, insertResponse } from '@/lib/d1';
import { createMember, emailExists } from '@/lib/members/createMember';
import { applyBindings, validateAnswers, visibleQuestions } from '@/lib/forms/schema';
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
        { success: false, code: 'tooFast', error: '잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    const rawAnswers = (body.answers ?? {}) as Answers;
    if (JSON.stringify(rawAnswers).length > MAX_ANSWERS_BYTES) {
      return NextResponse.json(
        { success: false, code: 'tooLong', error: '입력이 너무 깁니다. 내용을 줄여 주세요.' },
        { status: 413 }
      );
    }

    // ── 2) 폼 상태를 서버에서 다시 본다
    const form = await getSubmittableFormBySlug(slug);
    if (!form) {
      return NextResponse.json(
        { success: false, code: 'notOpen', error: '접수가 마감되었거나 없는 신청서입니다.' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (form.opens_at && now < form.opens_at) {
      return NextResponse.json(
        { success: false, code: 'notOpenYet', error: '아직 접수가 시작되지 않았습니다.' },
        { status: 400 }
      );
    }
    if (form.closes_at && now > form.closes_at) {
      return NextResponse.json({ success: false, code: 'closed', error: '접수가 마감되었습니다.' }, { status: 400 });
    }

    // ── 3) 로그인 요구
    const session = await auth();
    if (form.requires_login && !session?.user?.id) {
      return NextResponse.json(
        { success: false, code: 'loginRequired', error: '로그인 후 작성하실 수 있습니다.' },
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
        { success: false, code: 'fieldErrors', error: '입력하지 않은 항목이 있습니다.', fieldErrors },
        { status: 400 }
      );
    }

    // ── 4.5) **임시 게시는 여기서 멈춘다.**
    //     검증까지는 진짜와 똑같이 겪게 하고(그래야 확인이 된다) 저장만 하지 않는다.
    //     회원가입도, 운영진 통지도, 구조 잠금도 일어나지 않는다 —
    //     보고 나서 과목을 고칠 수 있어야 임시 게시의 뜻이 산다.
    if (form.status === 'trial') {
      return NextResponse.json({ success: true, data: { responseId: 0, trial: true } });
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

    // ── 6) 신청서 안에서의 회원가입 (선택).
    //     **응답을 먼저 저장한 뒤에 만든다** — 신청이 목적이므로 그쪽이 먼저 안전해야 한다.
    //     계정 생성이 실패해도 접수는 그대로 남고, 화면이 무슨 일이 있었는지 알려 준다.
    let accountResult: 'created' | 'email_taken' | 'failed' | null = null;
    const wantsAccount =
      !userId && body.account && typeof body.account === 'object' && body.account.password;

    if (wantsAccount) {
      try {
        const { core } = applyBindings(schema, answers, form.schema_version);
        const role = body.account.role === 'student' ? 'student' : 'parent';
        // 학부모로 가입하면 보호자 이름이 계정 이름이고, 없으면 학생 이름으로 대신한다.
        const accountName =
          role === 'parent'
            ? core.guardian_name?.trim() || core.student_name
            : core.student_name;

        if (!core.email) {
          accountResult = 'failed';
        } else if (await emailExists(core.email)) {
          // 미검증 이메일로 남의 계정에 신청을 이어 붙이지 않는다. 로그인을 권한다.
          accountResult = 'email_taken';
        } else {
          const created = await createMember({
            role,
            email: core.email,
            password: String(body.account.password),
            name: accountName,
            phone: core.phone,
            agreed: body.account.agreed === true,
            childName: role === 'parent' ? core.student_name : null,
            // 신규 가족은 자녀도 아직 가입 전이다 — 여기서 막으면 아무도 가입할 수 없다.
            requireExistingChild: false,
          });

          if (created.ok) {
            accountResult = 'created';
            await attachSubmitter({
              responseId,
              submittedByUserId: created.userId,
              // 학부모 계정을 대상 학생으로 넣으면 나중에 학부모가 수업에 배정된다.
              studentUserId: role === 'student' ? created.userId : null,
              linkSource: 'signup',
            });
          } else {
            accountResult = created.code === 'email_taken' ? 'email_taken' : 'failed';
          }
        }
      } catch (error) {
        console.error('inline signup failed:', error);
        accountResult = 'failed';
      }
    }

    // ── 7) 통지. 실패해도 접수를 되돌리지 않는다.
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

    return NextResponse.json({ success: true, data: { responseId, account: accountResult } });
  } catch (error) {
    console.error('Form submit error:', error);
    return NextResponse.json(
      { success: false, code: 'serverError', error: '제출에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
