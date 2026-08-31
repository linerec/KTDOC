/**
 * 자료함의 서명들 — 잠금 쿠키 · 받기 링크 · IP 해시 (순수 함수)
 *
 * 셋 다 같은 관용구(HMAC-SHA256 over base64url JSON)라 한 곳에 둔다.
 * lib/r2/uploadTicket.ts와 같은 모양이고, 같은 이유로 저장소를 두지 않는다 —
 * 서명 자체가 근거다. 자료함을 열 때마다 D1에 세션 행을 쓰고 청소하는 일을
 * 만들지 않는다.
 *
 * 세 용도의 **열쇠를 갈라 둔다**(HKDF info). 잠금 쿠키 값을 받기 링크 자리에
 * 붙여 넣어도 통하지 않아야 한다.
 */

import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

/** 한 번 풀면 6시간. 공연 한 판을 덮고, 밤새 열려 있지는 않다. */
export const UNLOCK_TTL_MS = 6 * 60 * 60 * 1000;

/** 메일로 보낸 받기 링크는 하루. 현장 담당자가 당일에 쓰는 물건이다. */
export const LINK_TTL_MS = 24 * 60 * 60 * 1000;

type Purpose = 'unlock' | 'link';

function keyFor(secret: string, purpose: Purpose): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'ktdoc-resource', purpose, 32));
}

function sign(payload: string, secret: string, purpose: Purpose): string {
  return createHmac('sha256', keyFor(secret, purpose)).update(payload).digest('base64url');
}

function pack(claims: object, secret: string, purpose: Purpose): string {
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${payload}.${sign(payload, secret, purpose)}`;
}

function unpack<T>(token: string, secret: string, purpose: Purpose): T | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [payload, signature] = parts;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(payload, secret, purpose));
  // 길이가 다르면 timingSafeEqual이 던진다 — 길이 비교를 먼저(둘 다 '틀림'이다)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

/** 자료함마다 다른 쿠키 이름 — 하나를 풀어도 옆 자료함은 잠겨 있다. */
export function unlockCookieName(vaultId: number): string {
  return `rv_${vaultId}`;
}

export function signUnlockCookie(vaultId: number, secret: string, now = Date.now()): string {
  return pack({ vaultId, exp: now + UNLOCK_TTL_MS }, secret, 'unlock');
}

export function verifyUnlockCookie(
  token: string,
  vaultId: number,
  secret: string,
  now = Date.now()
): { vaultId: number; exp: number } | null {
  const claims = unpack<{ vaultId?: unknown; exp?: unknown }>(token, secret, 'unlock');
  if (!claims) return null;
  if (claims.vaultId !== vaultId) return null;
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp < now) {
    return null;
  }
  return { vaultId, exp: claims.exp };
}

export function signLinkToken(
  vaultId: number,
  epoch: number,
  secret: string,
  now = Date.now()
): string {
  return pack({ vaultId, epoch, exp: now + LINK_TTL_MS }, secret, 'link');
}

export function verifyLinkToken(
  token: string,
  secret: string,
  now = Date.now()
): { vaultId: number; epoch: number; exp: number } | null {
  const claims = unpack<{ vaultId?: unknown; epoch?: unknown; exp?: unknown }>(
    token,
    secret,
    'link'
  );
  if (!claims) return null;
  if (typeof claims.vaultId !== 'number' || typeof claims.epoch !== 'number') return null;
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp < now) {
    return null;
  }
  return { vaultId: claims.vaultId, epoch: claims.epoch, exp: claims.exp };
}

/**
 * 접근 기록에 남길 IP 지문.
 *
 * 원문을 남기지 않는 이유는 개인정보 최소화다. 우리가 답해야 하는 질문은
 * "같은 사람이 몇 번 두드렸나"이지 "그 사람이 어디 사나"가 아니다.
 */
export function hashIp(ip: string | null, secret: string): string | null {
  if (typeof ip !== 'string' || !ip) return null;
  return createHmac('sha256', keyFor(secret, 'unlock'))
    .update(`ip:${ip}`)
    .digest('base64url')
    .slice(0, 22);
}
