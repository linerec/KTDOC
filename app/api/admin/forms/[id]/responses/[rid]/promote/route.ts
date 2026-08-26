/**
 * POST /api/admin/forms/[id]/responses/[rid]/promote — 수강 배정 승격
 *
 * 응답 1건 → 선택한 과목 수만큼의 배정. createEnrollment 가 멱등(UPSERT)이라
 * 여러 번 눌러도 안전하다 — D1에 트랜잭션이 없으니 부분 실패했을 때 다시 누르는
 * 것이 유일한 복구 수단이고, 그래서 멱등이어야만 한다.
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
import {
  addResponseNote,
  createEnrollment,
  getConsents,
  getEnrollmentStatusesForUser,
  getProgramById,
  getResponseById,
  getSelections,
  markPromoted,
} from '@/lib/d1';
import { getMemberById, setPublicArchiveConsent } from '@/lib/members';
import { notifyEventAfterResponse } from '@/lib/mail/notify';

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
    const linked = selections.filter((s) => s.program_id != null);
    const unlinked = selections.filter((s) => s.program_id == null);

    if (linked.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            '이 신청의 과목에 연결된 수업이 없습니다. 신청서 편집의 ‘과목 · 기간’ 탭에서 수업을 연결해 주세요.',
        },
        { status: 400 }
      );
    }

    const staffId = session?.user?.id ?? null;

    // 운영진이 수업 화면에서 '취소'로 내려 둔 배정은 여기서 되살리지 않는다.
    // createEnrollment 는 무조건 덮어쓰는 UPSERT라, 이 검사가 없으면 신청 화면의
    // 배정 버튼이 수업 화면의 결정을 조용히 지운다(양쪽 다 옳아 보이는 화면이라
    // 누가 지웠는지 알 길도 없다).
    const existing = await getEnrollmentStatusesForUser(response.student_user_id);
    const toEnroll = linked.filter((s) => existing.get(s.program_id!) !== 'cancelled');
    const skippedCancelled = linked.filter((s) => existing.get(s.program_id!) === 'cancelled');

    for (const s of toEnroll) {
      await createEnrollment(s.program_id!, {
        user_id: response.student_user_id,
        status: 'active',
        note: `신청서 접수 #${responseId}`,
        enrolled_by: staffId,
      });
    }

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
    await addResponseNote({
      responseId,
      kind: 'enroll',
      fromStatus: response.status,
      toStatus: 'enrolled',
      body:
        `${member.name ?? '회원'}님을 수업 ${toEnroll.length}개에 배정했습니다.` +
        (unlinked.length > 0 ? ` (수업이 연결되지 않은 과목 ${unlinked.length}개는 건너뛰었습니다.)` : '') +
        (skippedCancelled.length > 0
          ? ` (이미 취소로 내려 둔 수업 ${skippedCancelled.length}개는 그대로 두었습니다 — 되살리려면 수업 화면에서 상태를 바꿔 주세요.)`
          : '') +
        consentNote,
      authorId: staffId,
      authorName: session?.user?.name ?? null,
      // 자동으로 쓴 문장이라 사람이 남긴 운영 메모를 덮지 않는다.
      system: true,
    });

    // 배정 안내 — 원생과 보호자에게 간다(notifyEvent가 보호자를 붙인다).
    // 예전에는 이 호출이 없어서, 수업 화면에서 배정한 사람만 안내를 받고
    // 신청서에서 배정된 사람은 자기가 어느 수업에 들어갔는지 듣지 못했다.
    if (toEnroll.length > 0) {
      const titles = (
        await Promise.all(
          toEnroll.map((s) => getProgramById(s.program_id!).catch(() => null))
        )
      )
        .filter((p): p is NonNullable<typeof p> => p != null)
        .map((p) => p.title_ko);

      notifyEventAfterResponse('enrollment.created', {
        userIds: [response.student_user_id],
        data: {
          name: member.name ?? '',
          title: titles.join(', '),
          schedule: '',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        enrolled: toEnroll.length,
        skipped: unlinked.length,
        skippedCancelled: skippedCancelled.length,
      },
    });
  } catch (error) {
    console.error('Admin form promote error:', error);
    return NextResponse.json({ success: false, error: '배정하지 못했습니다.' }, { status: 500 });
  }
}
