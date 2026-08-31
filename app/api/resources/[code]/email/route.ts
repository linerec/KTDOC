/**
 * 자료함 받기 링크 발송
 * POST /api/resources/[code]/email   { email }
 *
 * 파일을 붙이지 않는다. 첨부는 15MB에서 막히는데(받는 쪽 메일함이 정하는
 * 숫자다 — lib/mail/attachments.ts) 자료함은 100MB까지 받는다. 링크는 용량
 * 제한이 없고, 나간 뒤에도 관리 화면에서 통째로 무효화할 수 있다.
 *
 * 잠긴 사람은 보낼 수 없다 — 게이트를 지나야 한다. 그러지 않으면 번호만 아는
 * 사람이 아무 주소로나 열쇠를 뿌릴 수 있다.
 */

import { NextResponse } from 'next/server';
import { countRecentEmails, logAccess } from '@/lib/d1/resources';
import { notifyEvent } from '@/lib/mail/notify';
import { isValidResourceCode } from '@/lib/resources/code';
import { clientIp, resolvePublicGate, resourceSecret } from '@/lib/resources/publicGate';
import { hashIp, signLinkToken } from '@/lib/resources/tokens';
import { SITE_URL } from '@/lib/seoBusiness';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 같은 주소로 10분에 세 번까지 — 오타로 두세 번 누르는 것은 막지 않는다 */
const SEND_WINDOW_MS = 10 * 60 * 1000;
const SEND_LIMIT = 3;

type Ctx = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { code } = await params;
  if (!isValidResourceCode(code)) {
    return NextResponse.json({ success: false, error: '없는 번호입니다.' }, { status: 404 });
  }

  try {
    const { vault, verdict } = await resolvePublicGate({ code, need: 'email' });
    if (!verdict.ok || !vault) {
      const status = verdict.ok
        ? 404
        : verdict.reason === 'locked'
          ? 401
          : verdict.reason === 'email_denied'
            ? 403
            : 404;
      return NextResponse.json({ success: false, error: '보낼 수 없습니다.' }, { status });
    }

    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json(
        { success: false, error: '이메일 주소를 다시 확인해 주세요.' },
        { status: 400 }
      );
    }

    const since = new Date(Date.now() - SEND_WINDOW_MS)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);
    if ((await countRecentEmails(vault.id, email, since)) >= SEND_LIMIT) {
      return NextResponse.json(
        { success: false, error: '방금 보냈습니다. 메일함을 확인해 주세요.' },
        { status: 429 }
      );
    }

    const token = signLinkToken(vault.id, vault.linkEpoch, resourceSecret());
    const link = `${SITE_URL}/api/resources/${code}/unlock?k=${encodeURIComponent(token)}`;

    // 사람이 '보내기'를 누른 자리다 — 결과를 붙잡아 그대로 말한다.
    // 못 갔는데 "보냈습니다"를 띄우면 아무도 모른 채 기다린다.
    const result = await notifyEvent('resource.link', {
      directEmails: [email],
      data: { title: vault.title, link },
    });

    if (result.sent === 0) {
      console.error('[resources] 받기 링크 발송 실패:', result.outcomes);
      return NextResponse.json(
        { success: false, error: '메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 502 }
      );
    }

    await logAccess({
      vaultId: vault.id,
      code,
      action: 'email_sent',
      ipHash: hashIp(clientIp(request), resourceSecret()),
      userAgent: request.headers.get('user-agent'),
      detail: email,
    });

    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    console.error('[resources] 받기 링크 발송 오류:', error);
    return NextResponse.json({ success: false, error: '보내지 못했습니다.' }, { status: 500 });
  }
}
