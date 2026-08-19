/**
 * childEntries — 가입·자녀 추가 입력의 정규화 규칙
 *
 * 형제자매 지원의 입구다: 학부모가 자녀 여러 명을 한 번에 적어 낼 때
 * 공백·중복·이상한 값이 DB(student_guardians)까지 흘러가지 않게 거른다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CHILDREN,
  normalizeChildEntries,
  parseEnrollmentYear,
} from './childEntries.ts';

test('이름을 다듬고 빈 이름은 버린다', () => {
  const out = normalizeChildEntries([
    { name: '  김지우 ', enrollmentYear: 2024 },
    { name: '   ', enrollmentYear: 2023 },
    { name: '', enrollmentYear: 2022 },
  ]);
  assert.deepEqual(out, [{ name: '김지우', enrollmentYear: 2024 }]);
});

test('입학년도는 문자열도 받고, 범위 밖이면 null', () => {
  const out = normalizeChildEntries([
    { name: '김지우', enrollmentYear: '2024' },
    { name: '김서준', enrollmentYear: 1800 },
  ]);
  assert.deepEqual(out, [
    { name: '김지우', enrollmentYear: 2024 },
    { name: '김서준', enrollmentYear: null },
  ]);
});

test('같은 이름+같은 입학년도는 한 명으로 접는다 (연도가 다르면 남긴다)', () => {
  const out = normalizeChildEntries([
    { name: '김지우', enrollmentYear: 2024 },
    { name: '김지우', enrollmentYear: 2024 },
    { name: '김지우', enrollmentYear: 2022 },
  ]);
  assert.deepEqual(out, [
    { name: '김지우', enrollmentYear: 2024 },
    { name: '김지우', enrollmentYear: 2022 },
  ]);
});

test('배열이 아니면 빈 목록', () => {
  assert.deepEqual(normalizeChildEntries(undefined), []);
  assert.deepEqual(normalizeChildEntries('김지우'), []);
  assert.deepEqual(normalizeChildEntries({ name: '김지우' }), []);
});

test('자녀 수 상한을 넘는 입력은 잘라낸다', () => {
  const many = Array.from({ length: MAX_CHILDREN + 3 }, (_, i) => ({
    name: `자녀${i}`,
    enrollmentYear: 2024,
  }));
  assert.equal(normalizeChildEntries(many).length, MAX_CHILDREN);
});

test('parseEnrollmentYear — 1990~내년까지의 정수만', () => {
  const nextYear = new Date().getFullYear() + 1;
  assert.equal(parseEnrollmentYear('2024'), 2024);
  assert.equal(parseEnrollmentYear(nextYear), nextYear);
  assert.equal(parseEnrollmentYear(nextYear + 1), null);
  assert.equal(parseEnrollmentYear(1989), null);
  assert.equal(parseEnrollmentYear(''), null);
  assert.equal(parseEnrollmentYear(null), null);
  assert.equal(parseEnrollmentYear('abc'), null);
});
