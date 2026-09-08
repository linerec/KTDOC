/**
 * POST /api/admin/forms/[id]/responses/[rid]/promote — 수강 배정 승격
 *
 * 응답 1건 → 신청 과목에 맞춘 배정. 판단은 lib/forms/correctionRun.ts 의
 * reconcileEnrollments 다 — 정정·재제출·취소·어긋남 복구와 **같은 함수**라
 * "신청 과목 = 배정"이 한 자리에서 지켜진다. 계획이 멱등이라 여러 번 눌러도 안전하다.
 * D1에 트랜잭션이 없으니 부분 실패했을 때 다시 누르는 것이 유일한 복구 수단이고,
 * 그래서 멱등이어야만 한다.
 *
 * 재제출로 온 응답이면 옛 응답(대체한 줄기)이 만든 배정 중 신청에서 빠진 것을 함께
 * 거둔다 — 예전에는 새 응답의 배정만 더해져 옛 수업이 명단에 그대로 남았다.
 *
 * 배정 대상은 **student_user_id** 다. submitted_by_user_id 가 아니다 —
 * 학부모가 대리 제출했을 때 학부모를 수업에 배정하면 안 된다.
 *
 * 미디어 동의 동기화(설계서 §7.5): 현재 상태의 주인은 회원 프로필이고 응답의
 * 동의는 그 시점 서명이다. 승격할 때 **거부는 즉시 프로필에 내려쓰고**, 동의는
 * 이 시점에만 올린다. 비대칭인 이유는 모를 때 안 보여주는 쪽으로 실패하기 위해서다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { addResponseNote, getConsents, getResponseById, getSelections, markPromoted } from '@/lib/d1';
import { getMemberById, setPublicArchiveConsent } from '@/lib/members';
import { reconcileEnrollments } from '@/lib/forms/correctionRun';
import { describePlan } from '@/lib/forms/correction';

interface RouteParams {
  params: Promise<{ id: string; rid: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
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
    if (!response.student_user_id) {
      return NextResponse.json(
        { success: false, error: '먼저 이 신청을 회원과 연결해 주세요.' },
        { status: 400 }
      );
    }

    const member = await getMemberById(response.student_user_id);
    if (!member) {
      return NextResponse.json(
        { success: false, error: '연결된 회원을 찾을 수 없습니다. 다시 연결해 주세요.' },
        { status: 400 }
      );
    }

    const selections = await getSelections(responseId);
    if (!selections.some((s) => s.program_id != null)) {
      return NextResponse.json(
        {
          success: false,
          error:
            '이 신청의 과목에 연결된 수업이 없습니다. 신청서 편집의 ‘과목 · 기간’ 탭에서 수업을 연결해 주세요.',
        },
        { status: 400 }
      );
    }

    const actor = { id: session?.user?.id ?? null, name: session?.user?.name ?? null };

    // 배정 — 안내(등록 또는 변경)까지 여기서 나간다. 이력은 아래 'enroll' 한 줄로 합친다.
    const result = await reconcileEnrollments({ response, actor, notify: true, silentNote: true });
    const plan = result.plan;

    // 미디어 동의를 프로필로 옮긴다. 거부는 즉시, 동의는 이 시점에만.
    let consentNote = '';
    const consents = await getConsents(responseId);
    const media = consents.find((c) => c.consent_key === 'media_release');
    if (media) {
      await setPublicArchiveConsent(response.student_user_id, media.agreed === 1);
      consentNote =
        media.agreed === 1
          ? ' 미디어 활용에 동의하여 공개 아카이브 노출을 켰습니다.'
          : ' 미디어 활용에 동의하지 않아 공개 아카이브 노출을 껐습니다.';
    }

    await markPromoted(responseId);
    const added = plan.add.length + plan.revive.length;
    await addResponseNote({
      responseId,
      kind: 'enroll',
      fromStatus: response.status,
      toStatus: 'enrolled',
      body:
        (result.noop
          ? `${member.name ?? '회원'}님의 명단은 이미 신청 과목과 같습니다.`
          : `${member.name ?? '회원'}님을 수업 ${added}개에 배정했습니다.`) +
        (plan.remove.length > 0 || plan.unlinked.length > 0 || plan.skippedCancelled.length > 0
          ? '\n' + describePlan(plan).join('\n')
          : '') +
        consentNote,
      authorId: actor.id,
      authorName: actor.name,
      // 자동으로 쓴 문장이라 사람이 남긴 운영 메모를 덮지 않는다.
      system: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        enrolled: added,
        removed: plan.remove.length,
        skipped: plan.unlinked.length,
        skippedCancelled: plan.skippedCancelled.length,
        summary: result.summary,
      },
    });
  } catch (error) {
    console.error('Admin form promote error:', error);
    return NextResponse.json({ success: false, error: '배정하지 못했습니다.' }, { status: 500 });
  }
}
