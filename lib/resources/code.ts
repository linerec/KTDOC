/**
 * 자료함 번호 — 사람이 전화로 불러 주고, 주소창에 치는 여섯 자리 (순수 함수)
 *
 * 앞자리 0을 뺀 이유는 실용이다. "공사칠일이팔"을 받아 적는 사람은 앞의 0을
 * 흘리고, 스프레드시트에 붙이면 0이 사라진다. 90만 가지에서 10만 가지를
 * 버리는 대신 **불러 준 대로 쳐도 맞는** 번호가 된다.
 *
 * 번호 자체는 비밀이 아니다 — 여섯 자리는 봇이 몇 시간이면 다 훑는다.
 * 보호는 비밀번호(lib/resources/passcode.ts)와 차단(lib/resources/rateLimit.ts)이
 * 맡는다. 이 파일은 "형태가 번호인가"만 본다.
 */

import { randomInt } from 'node:crypto';

export const RESOURCE_CODE_LENGTH = 6;

const CODE_RE = /^[1-9]\d{5}$/;

/** 주소에서 온 값이 번호 형태인가. 무엇이 와도 던지지 않는다. */
export function isValidResourceCode(value: string): boolean {
  return typeof value === 'string' && CODE_RE.test(value);
}

/**
 * 새 번호 하나. 중복 회피는 부르는 쪽(D1)이 한다 — 이 파일은 D1을 모른다.
 * `pick`을 주입받는 이유는 시험이 경계값을 고정할 수 있어야 해서다.
 */
export function generateResourceCode(
  pick: () => number = () => randomInt(100000, 1000000)
): string {
  return String(pick());
}
