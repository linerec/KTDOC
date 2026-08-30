/**
 * 신청 건 개별 메시지 — 수신자 후보 조립 (순수 함수)
 *
 * 이 화면이 하는 일은 "이 신청 건에 대해 이분께 메일 한 통"이다. 그런데
 * '이분'의 주소가 하나가 아니다 — 신청서에 적어 주신 주소, 연결된 회원
 * 계정의 주소, 원생이면 보호자 계정의 주소. 셋은 다를 수 있고 실제로 다르다
 * (학부모가 자기 메일 주소로 자녀를 신청한 건이 있다).
 *
 * 그래서 화면은 "보냅니다"가 아니라 **"어디로 갑니다"**를 먼저 말해야 한다.
 * 발송은 되돌릴 수 없는데, 어디로 갔는지 모르면 잘못 갔다는 사실조차 모른다.
 *
 * lib/mail/recipients.ts와 같은 이유로 순수하게 두고 시험으로 의도를 잠근다 —
 * 조건이 하나 빠져도 아무도 눈치채지 못하는 자리다(메일이 안 온 걸 눈치채는
 * 사람이 없다).
 */

// 상대 import에 확장자를 붙인다 — 이 모듈은 node --test로 직접 실행되고,
// Node ESM은 확장자를 요구한다(tsconfig의 allowImportingTsExtensions가 이를 허용).
import { isValidEmail } from '../mail/config.ts';

export type MessageRecipientRole = 'applicant' | 'account' | 'guardian';

/** 고를 수 없는 이유. 조용히 빼지 않고 이유를 화면에 남긴다. */
export type MessageRecipientBlock = 'opted-out' | 'invalid-address';

export interface MessageRecipient {
  /** 소문자 주소. 클라이언트는 이 키만 돌려보낸다(임의 주소를 넣지 못하게). */
  key: string;
  email: string;
  name: string | null;
  role: MessageRecipientRole;
  /** 이 주소가 어디서 온 것인지 — 화면에 그대로 붙는 한 줄 */
  note: string;
  /** 화면을 열었을 때 기본으로 켜져 있는가 */
  defaultOn: boolean;
  blocked: MessageRecipientBlock | null;
}

export interface BuildMessageRecipientsInput {
  /** 신청서에 적어 주신 주소 */
  responseEmail: string | null;
  /** 신청서에 적힌 학생 이름 — 연결된 회원이 없을 때의 표시명 */
  studentName: string;
  /** 이 신청과 연결된 회원(없을 수 있다) */
  member: { name: string | null; email: string | null } | null;
  /** 연결된 회원이 원생일 때의 보호자들 */
  guardians?: { name: string | null; email: string }[];
  /** 이메일 수신을 꺼둔 주소들(대소문자 무관) */
  optedOutEmails?: string[];
}

/**
 * 보낼 수 있는 주소 후보를 순서대로 만든다.
 *
 * 순서와 기본값의 근거:
 *  1. 신청서 주소 — **기본 켬.** 이 신청 건의 연락처로 본인이 적은 주소다.
 *  2. 회원 계정 주소 — 신청서 주소와 다를 때만 후보로 두고 **기본 끔.**
 *     학부모가 자기 주소로 신청한 건에서 이걸 켜두면, 부모에게 하려던 말이
 *     아이 계정으로도 간다.
 *  3. 보호자 계정 주소 — **기본 켬.** 원생은 미성년이라 메일을 잘 보지 않는다
 *     (lib/mail/notify.ts가 같은 이유로 보호자를 붙인다).
 *
 * 같은 주소는 한 번만 나온다 — 위 순서에서 먼저 나온 쪽이 이긴다. 형제가 둘인
 * 보호자가 같은 메일을 두 통 받는 일이 없어야 한다.
 */
export function buildMessageRecipients(
  input: BuildMessageRecipientsInput
): MessageRecipient[] {
  const optedOut = new Set(
    (input.optedOutEmails ?? [])
      .filter(Boolean)
      .map((e) => e.trim().toLowerCase())
  );

  const out: MessageRecipient[] = [];
  const seen = new Set<string>();

  const add = (
    rawEmail: string | null | undefined,
    name: string | null,
    role: MessageRecipientRole,
    note: string,
    defaultOn: boolean
  ) => {
    const email = (rawEmail ?? '').trim();
    if (!email) return;
    const key = email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      key,
      email,
      name,
      role,
      note,
      defaultOn,
      blocked: !isValidEmail(email)
        ? 'invalid-address'
        : optedOut.has(key)
          ? 'opted-out'
          : null,
    });
  };

  add(
    input.responseEmail,
    input.member?.name ?? input.studentName ?? null,
    'applicant',
    '신청서에 적어 주신 주소',
    true
  );

  add(
    input.member?.email,
    input.member?.name ?? null,
    'account',
    '연결된 회원 계정의 주소',
    false
  );

  for (const g of input.guardians ?? []) {
    add(g.email, g.name, 'guardian', '연결된 보호자 계정의 주소', true);
  }

  return out;
}

/** 화면을 열었을 때 켜져 있어야 할 주소들. 잠긴 주소는 켜지 않는다. */
export function defaultRecipientKeys(list: MessageRecipient[]): string[] {
  return list.filter((r) => r.defaultOn && !r.blocked).map((r) => r.key);
}

/**
 * 클라이언트가 고른 키를 실제 주소로 되돌린다.
 * 후보에 없는 키·잠긴 주소는 버린다 — 화면에서 보이지 않던 주소로는 나가지 않는다.
 */
export function resolvePickedAddresses(
  list: MessageRecipient[],
  keys: string[]
): string[] {
  const picked = new Set(keys.map((k) => String(k).trim().toLowerCase()));
  return list
    .filter((r) => picked.has(r.key) && !r.blocked)
    .map((r) => r.email);
}
