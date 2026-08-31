/**
 * 비밀번호의 **모양** — 화면과 서버가 함께 쓴다 (순수 함수, 브라우저 안전)
 *
 * 암·복호(lib/resources/passcode.ts)와 갈라 둔 이유가 두 가지다:
 *
 * 1. **node:crypto가 브라우저에 없다.** Next가 끼워 넣는 crypto-browserify에는
 *    randomInt가 아예 없어서, 관리 화면이 "비밀번호 생성"을 누르는 순간이
 *    아니라 **화면을 여는 순간** TypeError로 죽었다. 실제로 겪었다.
 * 2. 갈라 두지 않으면 AES 암복호 코드가 클라이언트 번들에 실린다. 쓰이지도
 *    않는 암호 코드를 브라우저로 보낼 이유가 없다.
 *
 * 그래서 여기서는 표준 Web Crypto(globalThis.crypto)만 쓴다 — 브라우저와
 * Node 19+ 양쪽에 같은 이름으로 있다.
 */

export const PASSCODE_MIN = 4;
export const PASSCODE_MAX = 8;

const PASSCODE_RE = new RegExp(`^\\d{${PASSCODE_MIN},${PASSCODE_MAX}}$`);

/** 숫자 네 자리에서 여덟 자리. 앞자리 0을 허용한다 — 주소가 아니라 입력이다. */
export function isValidPasscode(value: string): boolean {
  return typeof value === 'string' && PASSCODE_RE.test(value);
}

/**
 * 무작위 숫자 한 자리(0~9).
 *
 * 바이트를 그냥 %10 하면 0~5가 6~9보다 자주 나온다(256이 10으로 나뉘지 않는다).
 * 250 이상을 버리면 남는 250개가 10으로 정확히 갈라져 치우침이 없어진다.
 */
function randomDigit(): number {
  const buf = new Uint8Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < 250) return buf[0] % 10;
  }
}

/** 무작위 비밀번호. 화면의 '생성' 버튼과 서버가 같은 함수를 쓴다. */
export function generatePasscode(
  length = 6,
  pick: (maxExclusive: number) => number = () => randomDigit()
): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String(pick(10));
  return out;
}
