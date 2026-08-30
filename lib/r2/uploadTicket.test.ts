/**
 * lib/r2/uploadTicket.test.ts — 허가증이 허가증답게 굴러야 한다
 *
 * 파일이 서버를 지나지 않으므로, "이 키를 기록해 주세요"라는 말의 진위를
 * 판단하는 것은 이 서명뿐이다. 여기가 뚫리면 남의 사진을 제 기록에 붙이거나,
 * 허락받지 않은 자리에 파일을 심을 수 있다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildObjectKey,
  derivativeKeyFor,
  originalKeyFor,
  signTicket,
  verifyTicket,
  type UploadTicketClaims,
} from './uploadTicket.ts';

const SECRET = 'test-secret';
const NOW = 1_700_000_000_000;

function claims(over: Partial<UploadTicketClaims> = {}): UploadTicketClaims {
  return {
    key: 'gallery/photos/1-abc-photo.jpg',
    target: 'gallery-photos',
    contentType: 'image/jpeg',
    size: 1234,
    user: 'user-1',
    exp: NOW + 60_000,
    ...over,
  };
}

test('제대로 발급한 티켓은 통과한다', () => {
  const token = signTicket(claims(), SECRET);
  const r = verifyTicket(token, { secret: SECRET, now: NOW, user: 'user-1', target: 'gallery-photos' });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.claims.key, 'gallery/photos/1-abc-photo.jpg');
});

test('내용을 고치면 서명이 깨진다 — 키를 바꿔치기할 수 없다', () => {
  const token = signTicket(claims(), SECRET);
  const [payload, sig] = token.split('.');
  const tampered = JSON.parse(Buffer.from(payload, 'base64url').toString());
  tampered.key = 'gallery/photos/남의사진.jpg';
  const forged = `${Buffer.from(JSON.stringify(tampered)).toString('base64url')}.${sig}`;
  assert.deepEqual(verifyTicket(forged, { secret: SECRET, now: NOW }), {
    ok: false,
    reason: 'bad-signature',
  });
});

test('다른 열쇠로 만든 티켓은 통과하지 못한다', () => {
  const token = signTicket(claims(), 'another-secret');
  assert.equal(verifyTicket(token, { secret: SECRET, now: NOW }).ok, false);
});

test('만료된 티켓은 거절한다', () => {
  const token = signTicket(claims({ exp: NOW - 1 }), SECRET);
  assert.deepEqual(verifyTicket(token, { secret: SECRET, now: NOW }), {
    ok: false,
    reason: 'expired',
  });
});

test('남의 티켓·다른 용도의 티켓은 거절한다', () => {
  const token = signTicket(claims(), SECRET);
  const stranger = verifyTicket(token, { secret: SECRET, now: NOW, user: 'user-2' });
  assert.deepEqual(stranger, { ok: false, reason: 'wrong-user' });
  const other = verifyTicket(token, { secret: SECRET, now: NOW, target: 'news' });
  assert.deepEqual(other, { ok: false, reason: 'wrong-target' });
});

test('망가진 토큰에 던지지 않는다', () => {
  for (const bad of ['', 'x', 'a.b.c', '....']) {
    const r = verifyTicket(bad, { secret: SECRET, now: NOW });
    assert.equal(r.ok, false);
  }
});

test('객체 키는 폴더 아래에 만들어지고 이상한 문자를 남기지 않는다', () => {
  const key = buildObjectKey('gallery/photos', '../../etc/공연 사진.JPG', NOW);
  assert.match(key, /^gallery\/photos\/1700000000000-[a-z0-9]{1,6}-_+\.JPG$/);
  assert.ok(!key.includes('..'));
});

test('원본과 파생본은 서로 다른 자리에 눕고, 접두사로 이어진다', () => {
  const display = 'gallery/photos/1700000000000-ab12cd-photo.jpg';
  assert.equal(originalKeyFor(display), 'originals/gallery/photos/1700000000000-ab12cd-photo.jpg');
  assert.equal(
    derivativeKeyFor(display, 'photo.webp'),
    'gallery/photos/1700000000000-ab12cd-photo.webp'
  );
});
