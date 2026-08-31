/**
 * 공개 쪽 게이트 해석 — 쿠키·링크 토큰을 읽어 사실로 바꾼 뒤 gate.ts에 묻는다.
 *
 * 판정 자체는 하지 않는다. 여기가 하는 일은 "서명을 검증해 사실로 바꾸는 것"
 * 뿐이고, 열어도 되는가는 evaluateGate 하나가 답한다. 화면·재생·다운로드·
 * 메일이 전부 이 함수를 지나므로 네 자리의 판단이 어긋날 수 없다.
 */

import 'server-only';
import { cookies } from 'next/headers';
import { getVaultByCode } from '@/lib/d1/resources';
import { evaluateGate, type GateNeed, type GateVerdict } from './gate';
import { unlockCookieName, verifyLinkToken, verifyUnlockCookie } from './tokens';
import type { ResourceVault } from '@/types/resources';

export function resourceSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET 없음 — 자료함을 열 수 없습니다.');
  return secret;
}

export interface PublicGate {
  vault: ResourceVault | null;
  verdict: GateVerdict;
}

export async function resolvePublicGate(input: {
  code: string;
  need: GateNeed;
  /** 주소의 ?k= 값 (메일 받기 링크) */
  linkToken?: string | null;
}): Promise<PublicGate> {
  const secret = resourceSecret();
  const vault = await getVaultByCode(input.code);

  if (!vault) {
    return { vault: null, verdict: { ok: false, reason: 'not_found' } };
  }

  const jar = await cookies();
  const raw = jar.get(unlockCookieName(vault.id))?.value ?? '';
  const cookie = raw ? verifyUnlockCookie(raw, vault.id, secret) : null;
  const link = input.linkToken ? verifyLinkToken(input.linkToken, secret) : null;

  const verdict = evaluateGate({
    vault: {
      id: vault.id,
      active: vault.active,
      expiresAt: vault.expiresAt,
      allowDownload: vault.allowDownload,
      allowEmail: vault.allowEmail,
      linkEpoch: vault.linkEpoch,
    },
    now: Date.now(),
    cookie: cookie ? { vaultId: cookie.vaultId } : null,
    link: link ? { vaultId: link.vaultId, epoch: link.epoch } : null,
    need: input.need,
  });

  return { vault, verdict };
}

/**
 * 요청에서 IP를 뽑는다. 모르면 null.
 *
 * `x-real-ip`를 먼저 보는 이유: Vercel이 값 하나로 딱 채워 주는 헤더다.
 * `x-forwarded-for`는 목록이라 앞에 무엇이 붙어 있는지 읽는 쪽이 정해야 하고,
 * 그 애매함이 곧 "요청마다 새 신원을 만들어 차단을 피하는" 길이 된다.
 * 차단은 신원이 안정적일 때만 뜻이 있다.
 */
export function clientIp(request: Request): string | null {
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || null;
}
