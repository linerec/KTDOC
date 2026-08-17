/**
 * lib/mail/recipients.test.ts — "누가 받는가"를 잠근다
 *
 * 조건이 하나 빠져도 아무도 모르는 자리다 — 메일이 안 온 걸 눈치채는 사람이 없다.
 * 특히 다음이 뒤집히면 사고다:
 *  - 필수 메일이 개인 수신거부에 막힘 → 임시 비밀번호를 못 받아 계정을 못 씀
 *  - 스위치가 꺼졌는데 나감 → 원장이 끈 알림이 계속 감
 *  - 중복 제거가 빠짐 → 형제가 둘인 보호자가 같은 메일을 두 통 받음
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecipients, isAudienceOn } from './recipients.ts';
import type { MailEventDef } from './events.ts';

const plain: MailEventDef = {
  key: 'test.plain',
  label: '테스트',
  description: '',
  group: 'ops',
  audiences: ['user', 'staff'],
  defaultOn: { user: true, staff: true },
};

const essential: MailEventDef = {
  ...plain,
  key: 'test.essential',
  essential: ['user'],
};

test('스위치가 꺼져 있으면 아무에게도 보내지 않는다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'user',
    switches: { 'test.plain': { user: { email: false } } },
    candidates: [{ email: 'a@b.com', optIn: true }],
    staffTo: [],
  });
  assert.deepEqual(r.addresses, []);
  assert.equal(r.skipped[0].reason, 'switch-off');
});

test('설정이 없으면 레지스트리 기본값을 따른다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'user',
    switches: {},
    candidates: [{ email: 'a@b.com', optIn: true }],
    staffTo: [],
  });
  assert.deepEqual(r.addresses, ['a@b.com']);
});

test('기본값이 꺼짐인 이벤트는 설정이 없으면 안 나간다', () => {
  const offByDefault: MailEventDef = {
    ...plain,
    key: 'test.off',
    defaultOn: { user: false, staff: false },
  };
  const r = resolveRecipients({
    def: offByDefault,
    audience: 'user',
    switches: {},
    candidates: [{ email: 'a@b.com', optIn: true }],
    staffTo: [],
  });
  assert.deepEqual(r.addresses, []);
});

test('개인이 끄면 제외된다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'user',
    switches: {},
    candidates: [
      { email: 'yes@b.com', optIn: true },
      { email: 'no@b.com', optIn: false },
    ],
    staffTo: [],
  });
  assert.deepEqual(r.addresses, ['yes@b.com']);
  assert.equal(r.skipped[0].reason, 'opted-out');
});

test('필수 이벤트는 관리자 스위치도 개인 수신거부도 무시한다', () => {
  const r = resolveRecipients({
    def: essential,
    audience: 'user',
    switches: { 'test.essential': { user: { email: false } } },
    candidates: [{ email: 'no@b.com', optIn: false }],
    staffTo: [],
  });
  // 못 받으면 계정을 못 쓴다 — 두 관문을 모두 통과시킨다
  assert.deepEqual(r.addresses, ['no@b.com']);
});

test('주소가 없거나 형식이 깨지면 사유와 함께 제외한다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'user',
    switches: {},
    candidates: [
      { email: null, optIn: true },
      { email: '깨진주소', optIn: true },
      { email: 'ok@b.com', optIn: true },
    ],
    staffTo: [],
  });
  assert.deepEqual(r.addresses, ['ok@b.com']);
  assert.deepEqual(
    r.skipped.map((s) => s.reason).sort(),
    ['invalid-address', 'no-address']
  );
});

test('staff 대상은 staffTo를 쓰고 개인 수신거부가 없다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'staff',
    switches: {},
    candidates: [{ email: 'ignored@b.com', optIn: false }],
    staffTo: ['ops1@b.com', 'ops2@b.com'],
  });
  assert.deepEqual(r.addresses, ['ops1@b.com', 'ops2@b.com']);
});

test('중복 주소는 한 번만 남는다 — 형제가 둘이면 보호자가 두 번 들어온다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'user',
    switches: {},
    candidates: [
      { email: 'mom@b.com', optIn: true },
      { email: 'MOM@b.com', optIn: true },
      { email: 'kid@b.com', optIn: true },
    ],
    staffTo: [],
  });
  assert.equal(r.addresses.length, 2);
  assert.deepEqual(r.addresses, ['mom@b.com', 'kid@b.com']);
});

test('회원이 아닐 수 있는 이벤트는 옵트아웃 관문을 건너뛴다', () => {
  const nonMember: MailEventDef = { ...plain, key: 't.nm', allowNonMember: true };
  const r = resolveRecipients({
    def: nonMember,
    audience: 'user',
    // 비회원은 optIn 정보가 없다(undefined)
    switches: {},
    candidates: [{ email: 'guest@b.com' }],
    staffTo: [],
  });
  assert.deepEqual(r.addresses, ['guest@b.com']);
});

test('정의에 없는 대상은 항상 꺼짐', () => {
  const userOnly: MailEventDef = { ...plain, audiences: ['user'] };
  assert.equal(isAudienceOn(userOnly, 'staff', {}), false);
  const r = resolveRecipients({
    def: userOnly,
    audience: 'staff',
    switches: { 'test.plain': { staff: { email: true } } },
    candidates: [],
    staffTo: ['ops@b.com'],
  });
  assert.deepEqual(r.addresses, []);
});

test('저장된 스위치가 기본값을 이긴다', () => {
  const offByDefault: MailEventDef = {
    ...plain,
    key: 'test.off2',
    defaultOn: { user: false },
  };
  assert.equal(
    isAudienceOn(offByDefault, 'user', { 'test.off2': { user: { email: true } } }),
    true
  );
});
