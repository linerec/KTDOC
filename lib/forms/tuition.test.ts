/**
 * lib/forms/tuition.test.ts — 학비표를 재현하는가
 *
 * 이 시험이 지키는 것은 "패키지가는 산식이 아니다"라는 사실이다.
 * 누군가 나중에 '단품 합계 - 할인율'로 고치고 싶어질 텐데, 표가 그렇게 되어 있지 않다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupTuition, periodOf, tuitionForResponse } from './tuition.ts';
import type { FormQuestion } from '../../types/forms.ts';

/** 시험용 최소 문항 — 기간 하나와 과목 하나(선택지 셋). */
function questions(): FormQuestion[] {
  return [
    {
      key: 'q6_period',
      type: 'single',
      required: true,
      label: { ko: '등록 기간', en: 'Period' },
      options: [
        { key: 'm3', label: { ko: '3개월', en: '3 months' } },
        { key: 'm6', label: { ko: '6개월', en: '6 months' } },
        { key: 'y1', label: { ko: '1년', en: '1 year' } },
      ],
    },
    {
      key: 'q7_classes',
      type: 'multi',
      required: true,
      selectionOf: 'class',
      label: { ko: '수강 과목', en: 'Classes' },
      options: [
        { key: 'kids_dance', label: { ko: '유년부 무용', en: '' }, courseCode: 'dance_1' },
        { key: 'nanta_1drum', label: { ko: '난타 1', en: '' }, courseCode: 'kids_drum_1' },
        // 학비표에 자리가 아직 없는 과목 — courseCode 가 없다.
        { key: 'sun_dance', label: { ko: '일요 성인반', en: '' } },
      ],
    },
  ];
}

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

/* ── 응답 한 건 → 학비표 행 ─────────────────────────────────────────────
   목록과 상세가 같은 답을 내야 한다. 두 화면이 각자 조립하던 것을 여기로 모았다. */

test('고른 과목과 기간에서 표의 행을 찾는다', () => {
  const t = tuitionForResponse(questions(), { q6_period: 'm3' }, ['kids_dance', 'nanta_1drum']);
  assert.equal(t?.amount, 650);
  assert.equal(t?.label, '1 Dance + Kids Drum 1');
});

test('기간을 아직 모르면 조회하지 않는다', () => {
  assert.equal(tuitionForResponse(questions(), {}, ['kids_dance']), null);
  assert.equal(tuitionForResponse(questions(), { q6_period: null }, ['kids_dance']), null);
});

test('기간 문항이 없는 신청서(특강·설문)도 조용히 null 이다 — 터지지 않는다', () => {
  const noPeriod = questions().filter((q) => q.key !== 'q6_period');
  assert.equal(tuitionForResponse(noPeriod, { q6_period: 'm3' }, ['kids_dance']), null);
});

test('고른 과목이 없으면 null', () => {
  assert.equal(tuitionForResponse(questions(), { q6_period: 'm3' }, []), null);
});

test('학비표에 자리가 없는 과목이 섞이면 null — 목록에서도 틀린 금액을 띄우지 않는다', () => {
  assert.equal(tuitionForResponse(questions(), { q6_period: 'm3' }, ['kids_dance', 'sun_dance']), null);
});

test('지금 문안에 없는 옛 선택지는 모르는 과목으로 친다 — 옛 응답이 엉뚱한 금액을 갖지 않는다', () => {
  assert.equal(tuitionForResponse(questions(), { q6_period: 'm3' }, ['retired_class']), null);
});

test('기간 값이 표에 없는 것이면 조회하지 않는다', () => {
  assert.equal(tuitionForResponse(questions(), { q6_period: 'm9' }, ['kids_dance']), null);
});

test('기간은 따로도 읽는다 — 금액을 못 찾는 응답에도 기간은 보여 준다', () => {
  assert.equal(periodOf(questions(), { q6_period: 'y1' }), 'y1');
  assert.equal(periodOf(questions(), { q6_period: 'm9' }), null);
  assert.equal(periodOf([], { q6_period: 'y1' }), null);
});
