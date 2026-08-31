import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RESOURCE_CODE_LENGTH,
  generateResourceCode,
  isValidResourceCode,
} from './code.ts';

test('여섯 자리 숫자만 번호다', () => {
  assert.equal(isValidResourceCode('473128'), true);
  assert.equal(isValidResourceCode('100000'), true);
  assert.equal(isValidResourceCode('999999'), true);
});

test('앞자리 0은 번호가 아니다 — 전화로 불러 줄 때 사라진다', () => {
  assert.equal(isValidResourceCode('047312'), false);
  assert.equal(isValidResourceCode('000000'), false);
});

test('길이가 다르거나 숫자가 아니면 번호가 아니다', () => {
  for (const bad of ['4731', '4731289', '', '47a128', '47 128', '473128 ', ' 473128', '-47312']) {
    assert.equal(isValidResourceCode(bad), false, `${JSON.stringify(bad)}은 번호가 아니어야 한다`);
  }
});

test('문자열이 아닌 것을 받아도 던지지 않는다 — 주소에서 무엇이든 올 수 있다', () => {
  assert.equal(isValidResourceCode(undefined as unknown as string), false);
  assert.equal(isValidResourceCode(null as unknown as string), false);
  assert.equal(isValidResourceCode(473128 as unknown as string), false);
});

test('생성한 번호는 언제나 스스로의 검증을 통과한다', () => {
  for (let i = 0; i < 500; i++) {
    assert.equal(isValidResourceCode(generateResourceCode()), true);
  }
});

test('경계값 — 뽑기 함수가 하한·상한을 주면 그대로 나온다', () => {
  assert.equal(generateResourceCode(() => 100000), '100000');
  assert.equal(generateResourceCode(() => 999999), '999999');
});

test('길이 상수는 실제 길이와 같다', () => {
  assert.equal(generateResourceCode().length, RESOURCE_CODE_LENGTH);
});
