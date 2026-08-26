/**
 * Public Application API
 * POST /api/applications - 방문자 수업·캠프 신청 제출
 *
 * 1) 검증(필수값·이메일·동의·허니팟·최소제출시간·길이제한)
 * 2) 프로그램 확인(존재 + 공개 + **신청서가 붙지 않았을 것**) 후 D1에 신청 저장
 * 3) 알림 메일 (신청자 확인 + 운영진 알림) — 실패해도 신청은 유효하다.
 *    누구에게 보낼지는 관리 콘솔의 이메일 설정을 따른다(lib/mail).
 *
 * ※ 이 라우트는 **옛 경로**다. 신청서(forms)가 붙은 수업은 여기로 받지 않는다.
 *   화면에서 버튼을 지우는 것만으로는 부족했다 — 예전에 공유된 …#apply 링크,
 *   캐시된 페이지, 직접 호출이 남아 있어 화면을 고친 뒤에도 신청이 새어 들어왔다.
 *   판단 근거는 화면과 똑같이 getLinkedForm 하나다.
 */

import { NextResponse } from 'next/server';
import { getProgramById, createApplication, getLinkedForm } from '@/lib/d1';
import { acceptsLegacyApplication } from '@/lib/applyRoute';
import { notifyEventAfterResponse } from '@/lib/mail/notify';
import type { CreateApplicationInput } from '@/types/programs';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SUBMIT_MS = 2000;
const NAME_MAX = 120;
const MESSAGE_MAX = 5000;
const EMAIL_MAX = 254;
const SHORT_MAX = 40;
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  try {
    // 본문 크기 가드 (공개 엔드포인트 — 과도한 페이로드 차단)
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: '요청이 너무 큽니다.' },
        { status: 413 }
      );
    }

    const body = (await request.json()) as CreateApplicationInput;

    // 허니팟: 봇이 채우는 숨김 필드가 비어 있지 않으면 조용히 성공 처리
    if (body.website && body.website.trim() !== '') {
      return NextResponse.json({ success: true, data: { id: 0 } });
    }

    // 최소 제출 시간: _t(폼 렌더 시각)는 필수 — 누락/비정상 또는 2초 미만 제출은 봇으로 간주
    const renderedAt = Number(body._t);
    if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < MIN_SUBMIT_MS) {
      return NextResponse.json(
        { success: false, error: '잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    const applicantName = (body.applicant_name || '').trim();
    const email = (body.email || '').trim();

    if (!applicantName || !email) {
      return NextResponse.json(
        { success: false, error: '이름과 이메일은 필수입니다.' },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }
    if (body.consent !== true) {
      return NextResponse.json(
        { success: false, error: '개인정보 수집·이용에 동의해 주세요.' },
        { status: 400 }
      );
    }
    if (applicantName.length > NAME_MAX || (body.guardian_name || '').length > NAME_MAX) {
      return NextResponse.json(
        { success: false, error: '이름이 너무 깁니다.' },
        { status: 413 }
      );
    }
    if (
      email.length > EMAIL_MAX ||
      (body.phone || '').length > SHORT_MAX ||
      (body.participant_age || '').length > SHORT_MAX
    ) {
      return NextResponse.json(
        { success: false, error: '입력값이 너무 깁니다.' },
        { status: 413 }
      );
    }
    if ((body.message || '').length > MESSAGE_MAX) {
      return NextResponse.json(
        { success: false, error: '요청 사항이 너무 깁니다.' },
        { status: 413 }
      );
    }

    const programId = Number(body.program_id);
    if (!programId || isNaN(programId)) {
      return NextResponse.json(
        { success: false, error: '신청할 프로그램을 선택해 주세요.' },
        { status: 400 }
      );
    }

    const program = await getProgramById(programId);
    if (!program || !program.is_published) {
      return NextResponse.json(
        { success: false, error: '신청할 수 없는 프로그램입니다.' },
        { status: 404 }
      );
    }

    // 이 수업이 신청서로 옮겨 갔다면 옛 경로로는 받지 않는다.
    // 판단 규칙은 수업 상세 화면과 **같은 함수**를 쓴다(lib/applyRoute).
    // 409를 쓰는 이유: 요청이 틀린 게 아니라 받는 창구가 바뀐 것이다.
    const linkedForm = await getLinkedForm(program.active_form_id);
    if (!acceptsLegacyApplication(linkedForm) && linkedForm) {
      return NextResponse.json(
        {
          success: false,
          error: linkedForm.isOpen
            ? '이 수업은 수강 신청서로 접수합니다. 신청서에서 다시 신청해 주세요.'
            : '이 수업은 접수가 마감되었습니다.',
          redirect: linkedForm.isOpen ? `/f/${linkedForm.slug}` : null,
        },
        { status: 409 }
      );
    }

    const input: CreateApplicationInput = {
      program_id: programId,
      applicant_name: applicantName,
      guardian_name: (body.guardian_name || '').trim() || undefined,
      email,
      phone: (body.phone || '').trim() || undefined,
      participant_age: (body.participant_age || '').trim() || undefined,
      message: (body.message || '').trim() || undefined,
      consent: true,
    };

    const id = await createApplication(input, {
      program_title_snapshot: program.title_ko,
    });

    // 알림 메일 — 응답을 붙잡지 않는다(메일 서버가 느려도 신청 화면이 기다리지 않는다).
    // 실패해도 신청은 이미 저장됐다: 저장이 성공이면 접수 완료다.
    notifyEventAfterResponse('application.created', {
      directEmails: [input.email],
      replyTo: input.email,
      data: {
        name: input.applicant_name,
        title: program.title_ko,
        email: input.email,
        phone: input.phone ?? '',
      },
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Application submit error:', error);
    return NextResponse.json(
      { success: false, error: '신청 접수에 실패했습니다. 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
