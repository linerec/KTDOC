/**
 * 자료함 게이트 — "이 요청이 이 자료함을 열어도 되는가"의 **단 하나의 판정자**
 *
 * 화면과 라우트가 각자 판단하면 언젠가 어긋나고, **어긋난 쪽은 늘 열려 있는
 * 쪽이다.** 신청서에서 겪은 그대로다. 그래서 잠금·만료·비활성·세대·허용 토글을
 * 전부 이 함수 하나가 본다. 부르는 쪽은 결과만 받는다.
 *
 * 서명 검증은 여기서 하지 않는다 — 이 함수는 **검증이 끝난 사실**만 받는다.
 * 그래야 순수하게 남고, 조합을 시험으로 잠글 수 있다.
 *
 * 판정 순서에 뜻이 있다: 존재 → 상태(꺼짐·만료) → 열쇠 → 그 동작의 허용.
 * 열쇠가 없는 사람에게는 "다운로드가 막혀 있다" 같은 **설정을 알리지 않는다.**
 */

export type GateNeed = 'view' | 'download' | 'email';

export type GateDenial =
  | 'not_found'
  | 'inactive'
  | 'expired'
  | 'locked'
  | 'download_denied'
  | 'email_denied';

export interface GateVaultFacts {
  id: number;
  active: boolean;
  /** ISO 문자열. 없으면 만료 없음 */
  expiresAt: string | null;
  allowDownload: boolean;
  allowEmail: boolean;
  linkEpoch: number;
}

export type GateVerdict =
  | { ok: true; vaultId: number; via: 'cookie' | 'link' }
  | { ok: false; reason: GateDenial };

export function evaluateGate(input: {
  vault: GateVaultFacts | null;
  now: number;
  /** 서명 검증이 끝난 잠금 쿠키 */
  cookie: { vaultId: number } | null;
  /** 서명 검증이 끝난 받기 링크 토큰 */
  link: { vaultId: number; epoch: number } | null;
  need: GateNeed;
}): GateVerdict {
  const { vault, now, cookie, link, need } = input;

  if (!vault) return { ok: false, reason: 'not_found' };
  if (!vault.active) return { ok: false, reason: 'inactive' };

  if (vault.expiresAt) {
    const at = Date.parse(vault.expiresAt);
    // 읽을 수 없는 값은 만료로 치지 않는다 — 잘못 들어간 문자열 하나로
    // 공연장에서 자료함이 통째로 막히는 것이 더 나쁘다.
    if (Number.isFinite(at) && at <= now) return { ok: false, reason: 'expired' };
  }

  const via: 'cookie' | 'link' | null =
    cookie && cookie.vaultId === vault.id
      ? 'cookie'
      : link && link.vaultId === vault.id && link.epoch === vault.linkEpoch
        ? 'link'
        : null;

  if (!via) return { ok: false, reason: 'locked' };

  if (need === 'download' && !vault.allowDownload) {
    return { ok: false, reason: 'download_denied' };
  }
  if (need === 'email' && !vault.allowEmail) {
    return { ok: false, reason: 'email_denied' };
  }

  return { ok: true, vaultId: vault.id, via };
}
