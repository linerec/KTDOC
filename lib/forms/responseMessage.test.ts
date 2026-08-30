/**
 * lib/forms/responseMessage.test.ts — "이 메일이 어디로 가는가"를 잠근다
 *
 * 여기가 틀리면 선생님은 보냈다고 믿는데 상대는 못 받거나(수신거부를 무시하고
 * 조용히 건너뜀), 하려던 말이 엉뚱한 사람에게 간다(학부모 주소로 신청한 건에서
 * 아이 계정으로도 나감). 둘 다 화면만 봐서는 알 수 없다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMessageRecipients,
  defaultRecipientKeys,
  resolvePickedAddresses,
} from './responseMessage.ts';

test('신청서 주소가 첫 후보이고 기본으로 켜져 있다', () => {
  const list = buildMessageRecipients({
    responseEmail: 'parent@example.com',
    studentName: '오바다',
    member: null,
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].email, 'parent@example.com');
  assert.equal(list[0].role, 'applicant');
  assert.equal(list[0].defaultOn, true);
  assert.equal(list[0].blocked, null);
  assert.deepEqual(defaultRecipientKeys(list), ['parent@example.com']);
});

test('회원 계정 주소가 신청서 주소와 같으면 한 번만 나온다', () => {
  const list = buildMessageRecipients({
    responseEmail: 'Badah@Gmail.com',
    studentName: '오바다',
    member: { name: '오바다', email: 'badah@gmail.com' },
  });
  assert.equal(list.length, 1);
  // 표시는 사람이 적은 대로, 비교는 소문자로.
  assert.equal(list[0].email, 'Badah@Gmail.com');
  assert.equal(list[0].key, 'badah@gmail.com');
});

test('회원 계정 주소가 다르면 후보로 뜨지만 기본은 꺼져 있다', () => {
  const list = buildMessageRecipients({
    responseEmail: 'mom@example.com',
    studentName: '오바다',
    member: { name: '오바다', email: 'kid@example.com' },
  });
  assert.deepEqual(
    list.map((r) => [r.role, r.email, r.defaultOn]),
    [
      ['applicant', 'mom@example.com', true],
      ['account', 'kid@example.com', false],
    ]
  );
  assert.deepEqual(defaultRecipientKeys(list), ['mom@example.com']);
});

test('보호자 주소는 기본으로 켜진다 — 원생은 메일을 잘 보지 않는다', () => {
  const list = buildMessageRecipients({
    responseEmail: 'kid@example.com',
    studentName: '오바다',
    member: { name: '오바다', email: 'kid@example.com' },
    guardians: [{ name: '오엄마', email: 'mom@example.com' }],
  });
  assert.deepEqual(defaultRecipientKeys(list), [
    'kid@example.com',
    'mom@example.com',
  ]);
});

test('같은 보호자가 두 번 걸려도 주소는 한 번만 — 두 통 가지 않는다', () => {
  const list = buildMessageRecipients({
    responseEmail: 'kid@example.com',
    studentName: '오바다',
    member: { name: '오바다', email: 'kid@example.com' },
    guardians: [
      { name: '오엄마', email: 'mom@example.com' },
      { name: '오엄마', email: 'MOM@example.com' },
    ],
  });
  assert.equal(list.filter((r) => r.role === 'guardian').length, 1);
});

test('수신거부한 주소는 잠기고 기본 선택에서도 빠진다', () => {
  const list = buildMessageRecipients({
    responseEmail: 'kid@example.com',
    studentName: '오바다',
    member: { name: '오바다', email: 'kid@example.com' },
    guardians: [{ name: '오엄마', email: 'mom@example.com' }],
    optedOutEmails: ['KID@example.com'],
  });
  const kid = list.find((r) => r.key === 'kid@example.com');
  assert.equal(kid?.blocked, 'opted-out');
  // 잠겼어도 목록에는 남는다 — 왜 못 보내는지 화면이 말해야 한다.
  assert.deepEqual(defaultRecipientKeys(list), ['mom@example.com']);
});

test('형식이 깨진 주소는 잠근다', () => {
  const list = buildMessageRecipients({
    responseEmail: 'not-an-email',
    studentName: '오바다',
    member: null,
  });
  assert.equal(list[0].blocked, 'invalid-address');
  assert.deepEqual(defaultRecipientKeys(list), []);
});

test('후보에 없는 키로는 보낼 수 없다', () => {
  const list = buildMessageRecipients({
    responseEmail: 'kid@example.com',
    studentName: '오바다',
    member: null,
  });
  assert.deepEqual(
    resolvePickedAddresses(list, ['attacker@evil.com', 'KID@example.com']),
    ['kid@example.com']
  );
});

test('잠긴 주소는 골라도 보내지 않는다', () => {
  const list = buildMessageRecipients({
    responseEmail: 'kid@example.com',
    studentName: '오바다',
    member: null,
    optedOutEmails: ['kid@example.com'],
  });
  assert.deepEqual(resolvePickedAddresses(list, ['kid@example.com']), []);
});
