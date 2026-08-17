/**
 * 테스트 발송 — 저장본을 대상으로 보낸다
 *
 * 화면의 미저장 값을 받지 않는다. "빈 값 = 유지" 규칙과 얽히면 테스트는
 * 되는데 저장본은 다른 상태가 될 수 있다.
 *
 * 메일 설정은 조용히 실패하는 자리다. 저장 직후 눌러볼 수 있는 확인 경로가
 * 없으면, 틀린 비밀번호를 실제 가입이 유실될 때에야 알게 된다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { isValidEmail } from '@/lib/mail/config';
import { loadMailConfig } from '@/lib/mail/store';
import { resolveMailConfig, sendMail } from '@/lib/mail/mailer';
import { insertMailLogs } from '@/lib/d1/mailLog';

/** 오타 난 설정으로 연타하면 상대 SMTP 서버가 이쪽을 차단할 수 있다. */
const attempts = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const list = (attempts.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_ATTEMPTS) {
    attempts.set(userId, list);
    return true;
  }
  list.push(now);
  attempts.set(userId, list);
  return false;
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
    const userId = session?.user?.id ?? 'unknown';
    if (rateLimited(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: '테스트 발송이 너무 잦습니다. 10분 뒤에 다시 시도해 주세요.',
        },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { to?: string };
    const config = await loadMailConfig();
    const to = (body.to ?? '').trim() || config.staffTo[0] || '';
    if (!to || !isValidEmail(to)) {
      return NextResponse.json(
        { success: false, error: '받는 주소를 입력해 주세요.' },
        { status: 400 }
      );
    }

    const resolved = resolveMailConfig(config);
    if (resolved.provider === 'none') {
      return NextResponse.json(
        {
          success: false,
          error: '발송 설정이 완료되지 않았습니다.',
          detail: resolved.reason,
        },
        { status: 400 }
      );
    }

    // 도착한 메일만 보고도 어느 설정이 동작했는지 알 수 있게 본문에 적는다.
    const subject = '[KTDOC] 메일 설정 테스트';
    const text = [
      '이 메일이 보이면 발송 설정이 정상입니다.',
      '',
      `발송 방식: ${resolved.provider}`,
      `보내는 주소: ${resolved.fromName} <${resolved.from}>`,
      `답장 받을 주소: ${resolved.replyTo || '(미설정)'}`,
      `받는 주소: ${to}`,
      '',
      'If you can read this, the email configuration works.',
    ].join('\n');

    const result = await sendMail(resolved, { to: [to], subject, text });

    // 테스트도 내역에 남는다 — 한도를 실제로 먹기 때문에 게이지에 반영돼야 한다.
    await insertMailLogs([
      {
        eventKey: 'system.test',
        audience: 'staff',
        toAddress: to,
        subject,
        body: text,
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
    return NextResponse.json({ success: true, to, provider: resolved.provider });
  } catch (error) {
    console.error('메일 테스트 발송 오류:', error);
    return NextResponse.json(
      { success: false, error: '테스트 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
