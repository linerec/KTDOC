import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MANUAL_RESPONSE_STATUSES,
  REG_TYPE_LABEL,
  RESPONSE_STATUSES,
  RESPONSE_STATUS_BADGE,
  RESPONSE_STATUS_LABEL,
  findRegTypeQuestion,
  regTypeOf,
  responseStatusLabel,
} from './responseLabels.ts';
import { seasonPreset2026 } from './presets.ts';
import { allQuestions } from './schema.ts';
import type { ResponseStatus } from '../../types/forms.ts';

const ALL: ResponseStatus[] = [
  'new',
  'reviewing',
  'needs_info',
  'accepted',
  'enrolled',
  'declined',
  'cancelled',
];

test('모든 처리 상태에 라벨과 배지 색이 있다', () => {
  for (const s of ALL) {
    assert.ok(RESPONSE_STATUS_LABEL[s], `${s} 라벨 없음`);
    assert.ok(RESPONSE_STATUS_BADGE[s], `${s} 배지 없음`);
  }
  assert.deepEqual([...RESPONSE_STATUSES].sort(), [...ALL].sort());
});

test('처리 상태 라벨에 "신규"라는 말을 쓰지 않는다', () => {
  // 신청서가 신규 등록/재등록을 묻는다. 처리 상태가 같은 말을 쓰면 목록에서
  // 재등록 신청이 '신규'로 보인다 — 실제로 그렇게 읽혀 문의가 들어왔다.
  for (const s of ALL) {
    assert.ok(
      !RESPONSE_STATUS_LABEL[s].includes('신규'),
      `처리 상태 '${s}' 라벨이 등록 유형과 겹칩니다: ${RESPONSE_STATUS_LABEL[s]}`
    );
  }
});

test('수업 배정됨은 손으로 고를 수 없다', () => {
  assert.ok(!MANUAL_RESPONSE_STATUSES.includes('enrolled'));
  for (const s of MANUAL_RESPONSE_STATUSES) assert.ok(RESPONSE_STATUSES.includes(s));
});

test('이력의 상태 코드를 사람 말로 바꾸고, 모르는 코드는 그대로 둔다', () => {
  assert.equal(responseStatusLabel('new'), '확인 전');
  assert.equal(responseStatusLabel('reviewing'), '확인 중');
  assert.equal(responseStatusLabel('what_is_this'), 'what_is_this');
  assert.equal(responseStatusLabel(null), '');
});

test('정규 학기 신청서에서 등록 유형 문항을 찾는다', () => {
  const questions = allQuestions(seasonPreset2026());
  const q = findRegTypeQuestion(questions);
  assert.equal(q?.key, 'q1_reg_type');
  // 라벨 맵이 실제 선택지 키를 전부 덮는지 — 한쪽만 바뀌면 배지가 사라진다.
  for (const o of q?.options ?? []) {
    assert.ok(o.key in REG_TYPE_LABEL, `등록 유형 선택지 '${o.key}' 라벨 없음`);
  }
});

test('등록 유형을 읽고, 모르면 null 로 물러난다', () => {
  const questions = allQuestions(seasonPreset2026());
  assert.equal(regTypeOf(questions, { q1_reg_type: 'returning' }), 'returning');
  assert.equal(regTypeOf(questions, { q1_reg_type: 'new' }), 'new');
  assert.equal(regTypeOf(questions, {}), null);
  assert.equal(regTypeOf(questions, { q1_reg_type: 'zzz' }), null);
  // 등록 유형을 묻지 않는 신청서(특강·설문)
  assert.equal(regTypeOf([], { q1_reg_type: 'new' }), null);
});
