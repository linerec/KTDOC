/**
 * 요구사항 초안 폼 발송 — POST /api/feedback (관리자 전용)
 *
 * 개발 중 요구사항을 정리해 개발자에게 보내는 내부 도구다. 사이트 방문자용
 * 문의 폼이 아니다.
 *
 * ⚠ 관리자 인증이 반드시 필요하다. 예전에는 인증 없이 임의의 `to`로 메일을
 * 보낼 수 있었다 — 사이트 도메인 이름으로 아무 주소에나 메일을 뿌릴 수 있는
 * 상태였다(자격증명이 만료돼 있어 드러나지 않았을 뿐이다). 발송 설정이
 * 살아나는 순간 악용 가능해지므로 인증을 걷어내지 말 것.
 *
 * 발송은 공용 모듈(lib/mail)을 쓴다 — 관리 콘솔에서 정한 방법·주소를 따르고,
 * 지메일 자격증명에 묶이지 않는다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { isValidEmail } from '@/lib/mail/config';
import { loadMailConfig } from '@/lib/mail/store';
import { resolveMailConfig, sendMail } from '@/lib/mail/mailer';
import { insertMailLogs } from '@/lib/d1/mailLog';

export const runtime = 'nodejs';

/** 설정에 운영진 주소가 없을 때의 기본 수신처 */
const FALLBACK_RECIPIENT = 'owenkdev@gmail.com';

interface FeedbackBody {
  subject: string;
  body: string;
  isTest?: boolean;
  to?: string;
  replyTo?: string;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { subject, body, isTest, to, replyTo } =
      (await request.json()) as FeedbackBody;

    if (!subject || !body) {
      return NextResponse.json(
        { success: false, error: 'subject와 body가 필요합니다.' },
        { status: 400 }
      );
    }
    if (body.length > 50000) {
      return NextResponse.json(
        { success: false, error: '본문이 너무 깁니다 (50KB 초과).' },
        { status: 413 }
      );
    }
    if (to && !isValidEmail(to)) {
      return NextResponse.json(
        { success: false, error: '올바른 수신자 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }
    if (replyTo && !isValidEmail(replyTo)) {
      return NextResponse.json(
        { success: false, error: '올바른 Reply-To 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    const config = await loadMailConfig();
    const resolved = resolveMailConfig(config);
    if (resolved.provider === 'none') {
      return NextResponse.json(
        {
          success: false,
          error: '메일 발송 설정이 완료되지 않았습니다.',
          hint: '관리 콘솔의 이메일 설정에서 발송 방법과 보내는 주소를 지정하세요.',
          detail: resolved.reason,
        },
        { status: 503 }
      );
    }

    const recipient = to || config.staffTo[0] || FALLBACK_RECIPIENT;
    const finalSubject = isTest ? `[테스트] ${subject}` : subject;

    const result = await sendMail(resolved, {
      to: [recipient],
      subject: finalSubject,
      text: body,
      replyTo: replyTo || undefined,
    });

    // 이 발송도 한도를 먹으므로 내역에 남는다.
    await insertMailLogs([
      {
        eventKey: 'system.feedback',
        audience: 'staff',
        toAddress: recipient,
        subject: finalSubject,
        body,
        status: result.ok ? 'sent' : 'failed',
        detail: result.detail ?? null,
        provider: resolved.provider,
        providerId: result.providerId ?? null,
        quotaDaily: result.quotaDaily ?? null,
        quotaMonthly: result.quotaMonthly ?? null,
      },
    ]);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: '발송에 실패했습니다.', detail: result.detail },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, id: result.providerId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '서버 오류';
    console.error('feedback API error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
