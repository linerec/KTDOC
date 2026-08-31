/**
 * lib/forms/optionGroups.test.ts — 함께 고를 수 없는 짝
 *
 * 이 시험이 지키는 것은 "관계는 데이터가 말한다"는 사실이다.
 * 누군가 나중에 `if (key === 'drums_3standing')` 로 고치고 싶어질 텐데,
 * 그러면 다음 배타 관계마다 코드를 고쳐야 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockedByExclusive, exclusiveConflicts, exclusiveGroupNames } from './optionGroups.ts';
import type { FormOption } from '../../types/forms.ts';

/** 실폼을 닮은 최소 선택지 — 배타 그룹 하나(북) + 자유 선택지 둘 */
function options(): FormOption[] {
  return [
    { key: 'drums_3standing', label: { ko: '삼고무 · 동고' }, exclusiveGroup: 'standing_drums' },
    { key: 'drums_5standing', label: { ko: '오고무' }, exclusiveGroup: 'standing_drums' },
    { key: 'nanta_1drum', label: { ko: '난타 1드럼' }, exclusiveGroup: 'kids_nanta' },
    { key: 'nanta_3drum', label: { ko: '난타 3드럼' }, exclusiveGroup: 'kids_nanta' },
    { key: 'kids_dance', label: { ko: '유년부 무용' } },
    { key: 'kdrum_ensemble', label: { ko: 'K-드럼 앙상블' } },
  ];
}

/* ── 막기 ──────────────────────────────────────────────────────────── */

test('같은 그룹의 하나를 고르면 짝이 막힌다', () => {
  const blocked = blockedByExclusive(options(), ['drums_3standing']);
  assert.equal(blocked.get('drums_5standing'), 'drums_3standing');
});

test('고른 것 자신은 막지 않는다 — 막으면 해제할 수 없다', () => {
  const blocked = blockedByExclusive(options(), ['drums_3standing']);
  assert.equal(blocked.has('drums_3standing'), false);
});

test('다른 그룹과 그룹 없는 선택지는 자유롭다', () => {
  const blocked = blockedByExclusive(options(), ['drums_3standing']);
  assert.equal(blocked.has('nanta_1drum'), false);
  assert.equal(blocked.has('nanta_3drum'), false);
  assert.equal(blocked.has('kids_dance'), false);
  assert.equal(blocked.has('kdrum_ensemble'), false);
});

test('그룹이 여럿이면 각 그룹이 따로 막는다', () => {
  const blocked = blockedByExclusive(options(), ['drums_5standing', 'nanta_1drum']);
  assert.equal(blocked.get('drums_3standing'), 'drums_5standing');
  assert.equal(blocked.get('nanta_3drum'), 'nanta_1drum');
  assert.equal(blocked.size, 2);
});

test('아무것도 고르지 않으면 아무것도 막히지 않는다', () => {
  assert.equal(blockedByExclusive(options(), []).size, 0);
});

test('retired 선택지는 셈에서 빠진다 — 툼스톤이 새 신청을 막으면 안 된다', () => {
  const opts: FormOption[] = [
    { key: 'old_drums', label: { ko: '옛 북' }, exclusiveGroup: 'standing_drums', retired: true },
    ...options(),
  ];
  const blocked = blockedByExclusive(opts, ['old_drums']);
  assert.equal(blocked.size, 0);
});

test('빈 문자열 그룹은 그룹이 아니다 — 편집기에서 지운 자리다', () => {
  const opts: FormOption[] = [
    { key: 'a', label: { ko: 'A' }, exclusiveGroup: '' },
    { key: 'b', label: { ko: 'B' }, exclusiveGroup: '' },
  ];
  assert.equal(blockedByExclusive(opts, ['a']).size, 0);
});

/* ── 충돌(검증) ────────────────────────────────────────────────────── */

test('같은 그룹을 둘 고르면 충돌이다', () => {
  const conflicts = exclusiveConflicts(options(), ['drums_3standing', 'drums_5standing']);
  assert.deepEqual(conflicts, [['drums_3standing', 'drums_5standing']]);
});

test('충돌이 없으면 빈 배열 — 정상이 기본값이다', () => {
  assert.deepEqual(exclusiveConflicts(options(), ['drums_3standing', 'kids_dance']), []);
});

test('그룹이 둘 다 깨지면 둘 다 보고한다', () => {
  const conflicts = exclusiveConflicts(options(), [
    'drums_3standing',
    'drums_5standing',
    'nanta_1drum',
    'nanta_3drum',
  ]);
  assert.equal(conflicts.length, 2);
});

test('이미 둘 다 골라 있는 옛 응답도 충돌로 읽힌다 — 운영자가 알아야 한다', () => {
  // 실데이터: 응답 #117 Mia Park 이 삼고무·오고무를 함께 골랐다(규칙이 생기기 전).
  const conflicts = exclusiveConflicts(options(), [
    'drums_3standing',
    'drums_5standing',
    'kdrum_ensemble',
  ]);
  assert.equal(conflicts.length, 1);
});

test('지금 문안에 없는 옛 선택지는 충돌 판정에서 빠진다', () => {
  assert.deepEqual(exclusiveConflicts(options(), ['gone_key', 'drums_3standing']), []);
});

/* ── 그룹 이름 모으기(편집기·가이드) ──────────────────────────────── */

test('쓰이고 있는 그룹 이름을 모은다 — 편집기가 목록으로 보여 준다', () => {
  assert.deepEqual(exclusiveGroupNames(options()), ['standing_drums', 'kids_nanta']);
});

test('그룹이 없으면 빈 목록', () => {
  assert.deepEqual(exclusiveGroupNames([{ key: 'a', label: { ko: 'A' } }]), []);
});
