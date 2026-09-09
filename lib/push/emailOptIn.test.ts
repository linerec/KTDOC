/**
 * 알림 발송의 이메일 동시 발송 판정 시험
 *
 *   node --test lib/push/emailOptIn.test.ts
 *
 * 잠그는 사실은 하나다: **말하지 않으면 이메일은 가지 않는다.**
 * 2026-09-06~09 사이 공연 폼이 이 값을 빼고 부르는 바람에, 새 공연을 올릴 때마다
 * "[새 일정] 2021 KOTRA…" 같은 메일이 회원 47명에게 나갔다(원장님이 정지를 요청).
 * 기본값이 '켬'이면 새 호출부가 생길 때마다 같은 사고가 난다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { wantsEmail } from './emailOptIn.ts';

test('값이 없으면 이메일을 보내지 않는다 — 옛 호출부·새 호출부 모두', () => {
  assert.equal(wantsEmail(undefined), false);
  assert.equal(wantsEmail(null), false);
  assert.equal(wantsEmail({}), false);
});

test('명시적으로 true일 때만 보낸다', () => {
  assert.equal(wantsEmail({ alsoEmail: true }), true);
  assert.equal(wantsEmail({ alsoEmail: false }), false);
});

test('불리언이 아닌 값은 켠 것으로 치지 않는다 — 문자열 "true"·1도 아니다', () => {
  assert.equal(wantsEmail({ alsoEmail: 'true' }), false);
  assert.equal(wantsEmail({ alsoEmail: 1 }), false);
  assert.equal(wantsEmail({ alsoEmail: 'yes' }), false);
});
