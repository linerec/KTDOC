/**
 * 자료함 잠금 해제
 * POST /api/resources/[code]/unlock   { passcode } → 자료함 한정 쿠키
 * GET  /api/resources/[code]/unlock?k=…  메일 받기 링크 → 쿠키 굽고 /[code]로
 *
 * GET이 여기 있는 이유: 서버 컴포넌트는 쿠키를 굽지 못한다. 그래서 메일 링크는
 * 페이지가 아니라 이 라우트를 가리키고, 여기서 쿠키를 준 뒤 주소에서 토큰을
 * 지운 곳으로 보낸다 — 브라우저 기록·어깨너머에 열쇠가 남지 않는다.
 */

import { NextResponse } from 'next/server';
import { getVaultByCode, logAccess, recentFailures } from '@/lib/d1/resources';
import { isValidResourceCode } from '@/lib/resources/code';
import { evaluateGate } from '@/lib/resources/gate';
import { clientIp, resolvePublicGate, resourceSecret } from '@/lib/resources/publicGate';
import { passcodeMatches } from '@/lib/resources/passcode';
import { evaluateRateLimit, FAIL_WINDOW_MS } from '@/lib/resources/rateLimit';
import { hashIp, signUnlockCookie, unlockCookieName, UNLOCK_TTL_MS } from '@/lib/resources/tokens';

export const dynamic = 'force-dynamic';

/**
 * 실패에 주는 최소 지연.
 *
 * 없는 번호와 틀린 비밀번호가 서로 다른 속도로 답하면, 응답 시간만 재도
 * 어느 번호가 실재하는지 알 수 있다. 두 경우 모두 같은 만큼 기다린다.
 */
const FAIL_DELAY_MS = 400;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Ctx = { params: Promise<{ code: string }> };

function cookieHeader(vaultId: number, secret: string): string {
  const value = signUnlockCookie(vaultId, secret);
  const parts = [
    `${unlockCookieName(vaultId)}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(UNLOCK_TTL_MS / 1000)}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export async function POST(request: Request, { params }: Ctx) {
  const { code } = await params;
  if (!isValidResourceCode(code)) {
    return NextResponse.json({ success: false, error: '없는 번호입니다.' }, { status: 404 });
  }

  try {
    const secret = resourceSecret();
    const ipHash = hashIp(clientIp(request), secret);
    const userAgent = request.headers.get('user-agent');

    // ── 두드린 횟수를 먼저 본다(자료함이 있는지 묻기 전에)
    const since = new Date(Date.now() - FAIL_WINDOW_MS).toISOString().replace('T', ' ').slice(0, 19);
    const failures = await recentFailures(code, since);
    const limit = evaluateRateLimit({ now: Date.now(), ipHash, failures });
    if (limit.blocked) {
      await wait(FAIL_DELAY_MS);
      return NextResponse.json(
        { success: false, error: '잠시 후 다시 시도해 주세요.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
      );
    }

    const body = (await request.json().catch(() => null)) as { passcode?: unknown } | null;
    const passcode = typeof body?.passcode === 'string' ? body.passcode : '';

    const vault = await getVaultByCode(code);

    // 없는 번호는 실패로 기록한다 — 번호를 훑는 것 자체가 세어져야 한다
    if (!vault) {
      await logAccess({ vaultId: null, code, action: 'unlock_fail', ipHash, userAgent });
      await wait(FAIL_DELAY_MS);
      return NextResponse.json({ success: false, error: '다시 확인해 주세요.' }, { status: 404 });
    }

    // 꺼졌거나 기간이 지난 자료함 — **비밀번호를 보기 전에** 갈라낸다.
    //
    // 두 가지를 지킨다. 하나, "다시 확인해 주세요"라고 답하면 맞는 번호를 든
    // 사람이 자기 비밀번호를 의심하며 계속 두드린다. 둘, 그 시도가 차단
    // 카운터에 쌓여, 자료함을 다시 켰을 때 정작 그 사람이 막힌다.
    //
    // 판정은 여기서 새로 만들지 않고 게이트에 묻는다 — 열쇠 없이 물으면
    // inactive·expired·locked 중 하나로 답한다.
    const state = evaluateGate({
      vault: {
        id: vault.id,
        active: vault.active,
        expiresAt: vault.expiresAt,
        allowDownload: vault.allowDownload,
        allowEmail: vault.allowEmail,
        linkEpoch: vault.linkEpoch,
      },
      now: Date.now(),
      cookie: null,
      link: null,
      need: 'view',
    });
    if (!state.ok && state.reason !== 'locked') {
      return NextResponse.json(
        { success: false, error: '지금은 열 수 없는 자료함입니다.' },
        { status: 403 }
      );
    }

    if (!passcodeMatches(vault.passcodeEnc, passcode, secret)) {
      await logAccess({ vaultId: vault.id, code, action: 'unlock_fail', ipHash, userAgent });
      await wait(FAIL_DELAY_MS);
      return NextResponse.json({ success: false, error: '다시 확인해 주세요.' }, { status: 401 });
    }

    await logAccess({ vaultId: vault.id, code, action: 'unlock', ipHash, userAgent });

    const res = NextResponse.json({ success: true, data: { ok: true } });
    res.headers.set('Set-Cookie', cookieHeader(vault.id, secret));
    return res;
  } catch (error) {
    console.error('[resources] 잠금 해제 실패:', error);
    return NextResponse.json({ success: false, error: '열지 못했습니다.' }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: Ctx) {
  const { code } = await params;
  if (!isValidResourceCode(code)) return new NextResponse(null, { status: 404 });

  const token = new URL(request.url).searchParams.get('k');
  const back = new URL(`/${code}`, request.url);

  try {
    const { vault, verdict } = await resolvePublicGate({ code, need: 'view', linkToken: token });

    // 링크가 죽었으면 잠긴 화면으로 보낸다 — 거기서 비밀번호로 열 수 있다
    if (!verdict.ok || !vault || verdict.via !== 'link') {
      return NextResponse.redirect(back);
    }

    await logAccess({
      vaultId: vault.id,
      code,
      action: 'link_open',
      ipHash: hashIp(clientIp(request), resourceSecret()),
      userAgent: request.headers.get('user-agent'),
    });

    const res = NextResponse.redirect(back);
    res.headers.set('Set-Cookie', cookieHeader(vault.id, resourceSecret()));
    return res;
  } catch (error) {
    console.error('[resources] 링크 열기 실패:', error);
    return NextResponse.redirect(back);
  }
}
