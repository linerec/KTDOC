/**
 * Public Application API
 * POST /api/applications - 방문자 수업·캠프 신청 제출
 *
 * 1) 검증(필수값·이메일·동의·허니팟·최소제출시간·길이제한)
 * 2) 프로그램 확인(존재 + 공개) 후 D1에 신청 저장 (source of truth)
 * 3) 관리자에게 알림 메일 발송 (실패해도 신청은 유효 — try/catch)
 */

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getProgramById, createApplication } from '@/lib/d1';
import type { CreateApplicationInput } from '@/types/programs';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SUBMIT_MS = 2000;
const NAME_MAX = 120;
const MESSAGE_MAX = 5000;
const EMAIL_MAX = 254;
const SHORT_MAX = 40;
const MAX_BODY_BYTES = 64 * 1024;
const FALLBACK_RECIPIENT = 'owenkdev@gmail.com';

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

    // 관리자 알림 메일 (실패해도 신청은 저장됨)
    void sendAdminNotification(id, input, program.title_ko);

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Application submit error:', error);
    return NextResponse.json(
      { success: false, error: '신청 접수에 실패했습니다. 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}

async function sendAdminNotification(
  id: number,
  input: CreateApplicationInput,
  programTitle: string
): Promise<void> {
  try {
    const user = process.env.GMAIL_USER;
    const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
    if (!user || !password) {
      console.warn('[applications] GMAIL credentials missing — skipping admin email. Application #' + id + ' saved.');
      return;
    }

    const recipient = process.env.ADMIN_NOTIFY_EMAIL || user || FALLBACK_RECIPIENT;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass: password },
    });

    const lines = [
      `프로그램: ${programTitle}`,
      `신청자: ${input.applicant_name}`,
      input.guardian_name ? `보호자: ${input.guardian_name}` : null,
      `이메일: ${input.email}`,
      input.phone ? `전화번호: ${input.phone}` : null,
      input.participant_age ? `참가자 나이: ${input.participant_age}` : null,
      input.message ? `요청 사항: ${input.message}` : null,
      '',
      `관리자 화면에서 확인: /admin/applications`,
    ].filter(Boolean);

    await transporter.sendMail({
      from: `"KTDOC 신청 알림" <${user}>`,
      to: recipient,
      replyTo: input.email,
      subject: `[KTDOC 신청] ${programTitle} — ${input.applicant_name}`,
      text: lines.join('\n'),
    });
  } catch (e) {
    console.error('[applications] admin notification email failed (application still saved):', e);
  }
}
