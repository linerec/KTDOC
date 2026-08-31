import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LINK_TTL_MS,
  UNLOCK_TTL_MS,
  hashIp,
  signLinkToken,
  signUnlockCookie,
  unlockCookieName,
  verifyLinkToken,
  verifyUnlockCookie,
} from './tokens.ts';

const SECRET = 'test-secret-abcdefghijklmnopqrstuvwxyz';
const T0 = 1_700_000_000_000;

test('쿠키 이름은 자료함마다 다르다 — 하나를 풀어도 옆 자료함은 잠겨 있다', () => {
  assert.equal(unlockCookieName(12), 'rv_12');
  assert.notEqual(unlockCookieName(12), unlockCookieName(13));
});

test('서명한 쿠키는 같은 자료함에서 열린다', () => {
  const token = signUnlockCookie(12, SECRET, T0);
  const claims = verifyUnlockCookie(token, 12, SECRET, T0 + 1000);
  assert.equal(claims?.vaultId, 12);
  assert.equal(claims?.exp, T0 + UNLOCK_TTL_MS);
});

test('다른 자료함의 쿠키로는 열리지 않는다 — 값을 옮겨 붙여도', () => {
  const token = signUnlockCookie(12, SECRET, T0);
  assert.equal(verifyUnlockCookie(token, 13, SECRET, T0 + 1000), null);
});

test('만료된 쿠키는 열리지 않는다 (경계 포함)', () => {
  const token = signUnlockCookie(12, SECRET, T0);
  assert.notEqual(verifyUnlockCookie(token, 12, SECRET, T0 + UNLOCK_TTL_MS - 1), null);
  assert.equal(verifyUnlockCookie(token, 12, SECRET, T0 + UNLOCK_TTL_MS + 1), null);
});

test('서명이 다르면 열리지 않는다', () => {
  const token = signUnlockCookie(12, SECRET, T0);
  assert.equal(verifyUnlockCookie(token, 12, 'other-secret-aaaaaaaaaaaaaaaaaaaa', T0), null);
});

test('본문을 고치면 서명이 깨진다', () => {
  const token = signUnlockCookie(12, SECRET, T0);
  const [payload, sig] = token.split('.');
  const tampered = Buffer.from(
    JSON.stringify({ vaultId: 13, exp: T0 + UNLOCK_TTL_MS }),
    'utf8'
  ).toString('base64url');
  assert.equal(verifyUnlockCookie(`${tampered}.${sig}`, 13, SECRET, T0), null);
  assert.notEqual(payload, tampered);
});

test('망가진 모양은 전부 null이고 던지지 않는다', () => {
  for (const bad of ['', 'x', 'a.b.c', '.', undefined as unknown as string]) {
    assert.equal(verifyUnlockCookie(bad, 12, SECRET, T0), null);
    assert.equal(verifyLinkToken(bad, SECRET, T0), null);
  }
});

test('받기 링크 토큰은 자료함과 세대(epoch)를 함께 담는다', () => {
  const token = signLinkToken(7, 3, SECRET, T0);
  const claims = verifyLinkToken(token, SECRET, T0 + 1000);
  assert.equal(claims?.vaultId, 7);
  assert.equal(claims?.epoch, 3);
  assert.equal(claims?.exp, T0 + LINK_TTL_MS);
});

test('받기 링크는 24시간 뒤 죽는다', () => {
  const token = signLinkToken(7, 3, SECRET, T0);
  assert.notEqual(verifyLinkToken(token, SECRET, T0 + LINK_TTL_MS - 1), null);
  assert.equal(verifyLinkToken(token, SECRET, T0 + LINK_TTL_MS + 1), null);
});

test('잠금 쿠키를 받기 링크 자리에 붙여도 통하지 않는다 — 열쇠를 갈라 뒀다', () => {
  const cookie = signUnlockCookie(7, SECRET, T0);
  assert.equal(verifyLinkToken(cookie, SECRET, T0 + 1000), null);
  const link = signLinkToken(7, 1, SECRET, T0);
  assert.equal(verifyUnlockCookie(link, 7, SECRET, T0 + 1000), null);
});

test('IP 해시는 같은 주소에 같은 값, 다른 주소에 다른 값', () => {
  assert.equal(hashIp('203.0.113.9', SECRET), hashIp('203.0.113.9', SECRET));
  assert.notEqual(hashIp('203.0.113.9', SECRET), hashIp('203.0.113.10', SECRET));
});

test('IP 해시에 원문이 남지 않는다', () => {
  const h = hashIp('203.0.113.9', SECRET);
  assert.equal(typeof h, 'string');
  assert.ok(!h!.includes('203.0.113.9'));
});

test('IP를 모르면 null — 없는 값을 지어내지 않는다', () => {
  assert.equal(hashIp(null, SECRET), null);
  assert.equal(hashIp('', SECRET), null);
});
