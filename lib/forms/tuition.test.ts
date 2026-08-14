/**
 * lib/forms/tuition.test.ts — 학비표를 재현하는가
 *
 * 이 시험이 지키는 것은 "패키지가는 산식이 아니다"라는 사실이다.
 * 누군가 나중에 '단품 합계 - 할인율'로 고치고 싶어질 텐데, 표가 그렇게 되어 있지 않다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupTuition } from './tuition.ts';

test('단품 조회 — 유년부 무용 3개월은 $400', () => {
  assert.equal(lookupTuition(['dance_1'], 'm3')?.amount, 400);
  assert.equal(lookupTuition(['dance_1'], 'm6')?.amount, 720);
  assert.equal(lookupTuition(['dance_1'], 'y1')?.amount, 1140);
});

test('패키지가는 산식이 아니라 룩업이다 — 1 Dance + Kids Drum 1 은 $800 이 아니라 $650', () => {
  assert.equal(lookupTuition(['dance_1'], 'm3')!.amount + lookupTuition(['kids_drum_1'], 'm3')!.amount, 800);
  assert.equal(lookupTuition(['dance_1', 'kids_drum_1'], 'm3')?.amount, 650);
});

test('1년 등록도 산식이 아니다 — 400×4×0.8 = $1,280 이 아니라 $1,140', () => {
  assert.notEqual(lookupTuition(['dance_1'], 'y1')?.amount, 400 * 4 * 0.8);
  assert.equal(lookupTuition(['dance_1'], 'y1')?.amount, 1140);
});

test('표에 없는 조합은 null 이다 — 이것은 오류가 아니라 정상 상태다', () => {
  assert.equal(lookupTuition(['kids_drum_1', 'drums_3'], 'm3'), null);
  assert.equal(lookupTuition(['kids_drum_1', 'kids_drum_3'], 'm3'), null);
});

test('코스 순서가 달라도 같은 행을 찾는다', () => {
  assert.equal(
    lookupTuition(['kids_drum_1', 'dance_1'], 'm3')?.amount,
    lookupTuition(['dance_1', 'kids_drum_1'], 'm3')?.amount
  );
});

test('무용 두 과목은 같은 코스 코드가 두 번 온다 — 2 Dance Courses 행을 찾아야 한다', () => {
  assert.equal(lookupTuition(['dance_1', 'dance_1'], 'm3')?.amount, 650);
  assert.equal(lookupTuition(['dance_1', 'dance_1', 'drums_5'], 'y1')?.amount, 3220);
});

test('코스 코드가 하나라도 비면 조회하지 않는다 — 틀린 금액보다 모른다고 하는 게 낫다', () => {
  assert.equal(lookupTuition(['dance_1', undefined], 'm3'), null);
  assert.equal(lookupTuition(['dance_1', ''], 'm3'), null);
  assert.equal(lookupTuition([], 'm3'), null);
});

test('4과목까지 표에 있다', () => {
  assert.equal(lookupTuition(['dance_1', 'dance_1', 'drums_5', 'mega_drum'], 'y1')?.amount, 4200);
});

test('행 이름을 함께 돌려준다 — 운영자가 표 어디를 본 것인지 알아야 한다', () => {
  assert.equal(lookupTuition(['drums_5'], 'm3')?.label, '5 Standing Drums (오고무)');
});
