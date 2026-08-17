/**
 * 수신자 결정 — 3중 관문 (순수 함수)
 *
 * 조건이 하나 빠져도 아무도 모르는 자리다(메일이 안 온 걸 눈치채는 사람이 없다).
 * lib/d1/eventViews.ts와 같은 이유로 순수하게 유지하고 시험으로 의도를 잠근다.
 *
 *   1) 관리자가 이 이벤트 × 대상을 켰는가
 *   2) 개인이 끄지 않았는가
 *   3) 주소가 유효한가
 *
 * 필수(essential) 이벤트는 1·2를 통과한 것으로 본다 — 못 받으면 계정을 못 쓴다.
 */

// 상대 import에 확장자를 붙인다 — 이 모듈은 node --test로 직접 실행되고,
// Node ESM은 확장자를 요구한다(tsconfig의 allowImportingTsExtensions가 이를 허용).
import { isValidEmail } from './config.ts';
import { isEssential, type MailEventDef } from './events.ts';
import type { MailAudience, MailEventSwitches } from '@/types/mail';

export type SkipReason =
  | 'switch-off'
  | 'opted-out'
  | 'no-address'
  | 'invalid-address';

export interface RecipientCandidate {
  email: string | null;
  /**
   * 개인 수신 설정. 비회원(문의자 등)은 undefined —
   * allowNonMember 이벤트에서 관문을 건너뛴다.
   */
  optIn?: boolean;
}

export interface ResolveRecipientsInput {
  def: MailEventDef;
  audience: MailAudience;
  switches: MailEventSwitches;
  /** audience='user'일 때의 후보(당사자 + 보호자) */
  candidates: RecipientCandidate[];
  /** audience='staff'일 때의 수신처 */
  staffTo: string[];
}

export interface ResolveRecipientsResult {
  addresses: string[];
  skipped: { email: string | null; reason: SkipReason }[];
}

/** 관리자가 이 이벤트 × 대상을 켰는가. 설정에 없으면 레지스트리 기본값. */
export function isAudienceOn(
  def: MailEventDef,
  audience: MailAudience,
  switches: MailEventSwitches
): boolean {
  if (!def.audiences.includes(audience)) return false;
  const saved = switches[def.key]?.[audience];
  if (saved && typeof saved.email === 'boolean') return saved.email;
  return def.defaultOn[audience] ?? false;
}

export function resolveRecipients(
  input: ResolveRecipientsInput
): ResolveRecipientsResult {
  const { def, audience, switches, candidates, staffTo } = input;
  const skipped: ResolveRecipientsResult['skipped'] = [];
  const essential = isEssential(def, audience);

  // 정의에 없는 대상은 필수 여부와 무관하게 나가지 않는다.
  if (!def.audiences.includes(audience)) {
    return { addresses: [], skipped: [{ email: null, reason: 'switch-off' }] };
  }

  // 관문 1 — 관리자 스위치 (필수 이벤트는 통과한 것으로 본다)
  if (!essential && !isAudienceOn(def, audience, switches)) {
    return { addresses: [], skipped: [{ email: null, reason: 'switch-off' }] };
  }

  const raw: RecipientCandidate[] =
    audience === 'staff' ? staffTo.map((email) => ({ email })) : candidates;

  const seen = new Set<string>();
  const addresses: string[] = [];

  for (const c of raw) {
    // 관문 2 — 개인 수신거부 (staff·필수·비회원 이벤트는 해당 없음)
    if (
      audience === 'user' &&
      !essential &&
      !def.allowNonMember &&
      c.optIn === false
    ) {
      skipped.push({ email: c.email, reason: 'opted-out' });
      continue;
    }

    // 관문 3 — 주소 유효성
    if (!c.email) {
      skipped.push({ email: null, reason: 'no-address' });
      continue;
    }
    const email = c.email.trim();
    if (!isValidEmail(email)) {
      skipped.push({ email, reason: 'invalid-address' });
      continue;
    }

    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push(email);
  }

  return { addresses, skipped };
}
