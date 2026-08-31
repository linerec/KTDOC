import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSCODE_MAX,
  PASSCODE_MIN,
  decryptPasscode,
  encryptPasscode,
  generatePasscode,
  isValidPasscode,
  passcodeMatches,
} from './passcode.ts';

const SECRET = 'test-secret-abcdefghijklmnopqrstuvwxyz';

test('네 자리에서 여덟 자리 숫자만 비밀번호다', () => {
  assert.equal(isValidPasscode('1234'), true);
  assert.equal(isValidPasscode('12345678'), true);
  assert.equal(isValidPasscode('0000'), true, '비밀번호는 앞자리 0을 허용한다 — 주소가 아니라 입력이다');
  assert.equal(isValidPasscode('123'), false);
  assert.equal(isValidPasscode('123456789'), false);
  assert.equal(isValidPasscode('12a4'), false);
  assert.equal(isValidPasscode(''), false);
  assert.equal(isValidPasscode(undefined as unknown as string), false);
});

test('상수와 실제 경계가 어긋나지 않는다', () => {
  assert.equal(isValidPasscode('9'.repeat(PASSCODE_MIN)), true);
  assert.equal(isValidPasscode('9'.repeat(PASSCODE_MAX)), true);
  assert.equal(isValidPasscode('9'.repeat(PASSCODE_MIN - 1)), false);
  assert.equal(isValidPasscode('9'.repeat(PASSCODE_MAX + 1)), false);
});

test('생성한 비밀번호는 스스로의 검증을 통과한다', () => {
  for (let i = 0; i < 200; i++) {
    assert.equal(isValidPasscode(generatePasscode()), true);
  }
  assert.equal(generatePasscode().length, 6, '기본 길이는 여섯 자리');
  assert.equal(generatePasscode(4).length, 4);
  assert.equal(generatePasscode(8).length, 8);
});

test('암호화한 것을 다시 읽을 수 있다 — 원장이 번호를 다시 확인해야 한다', () => {
  const enc = encryptPasscode('473128', SECRET);
  assert.equal(decryptPasscode(enc, SECRET), '473128');
});

test('같은 비밀번호라도 암호문은 매번 다르다 — 같은 값을 쓴 자료함이 드러나면 안 된다', () => {
  const a = encryptPasscode('1234', SECRET);
  const b = encryptPasscode('1234', SECRET);
  assert.notEqual(a, b);
  assert.equal(decryptPasscode(a, SECRET), '1234');
  assert.equal(decryptPasscode(b, SECRET), '1234');
});

test('다른 열쇠로는 읽히지 않는다 — 던지지 않고 null', () => {
  const enc = encryptPasscode('1234', SECRET);
  assert.equal(decryptPasscode(enc, 'another-secret-value-here-0000000'), null);
});

test('변조된 암호문은 null — GCM 태그가 잡는다', () => {
  const enc = encryptPasscode('1234', SECRET);
  const parts = enc.split('.');
  const flipped = Buffer.from(parts[3], 'base64url');
  flipped[0] ^= 0xff;
  parts[3] = flipped.toString('base64url');
  assert.equal(decryptPasscode(parts.join('.'), SECRET), null);
});

test('망가진 모양은 전부 null이고 던지지 않는다', () => {
  for (const bad of ['', 'x', 'v1.a.b', 'v9.a.b.c', 'v1...', undefined as unknown as string]) {
    assert.equal(decryptPasscode(bad, SECRET), null);
  }
});

test('대조는 맞을 때만 참이다', () => {
  const enc = encryptPasscode('473128', SECRET);
  assert.equal(passcodeMatches(enc, '473128', SECRET), true);
  assert.equal(passcodeMatches(enc, '473129', SECRET), false);
  assert.equal(passcodeMatches(enc, '', SECRET), false);
  assert.equal(passcodeMatches('망가진값', '473128', SECRET), false);
});

test('길이가 다른 입력에도 대조가 던지지 않는다 — timingSafeEqual 함정', () => {
  const enc = encryptPasscode('1234', SECRET);
  assert.equal(passcodeMatches(enc, '12345678', SECRET), false);
  assert.equal(passcodeMatches(enc, '1', SECRET), false);
});
