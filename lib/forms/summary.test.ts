import test from 'node:test';
import assert from 'node:assert/strict';

import { hasSummary, summarizeAnswers } from './summary.ts';
import { seasonPreset2026, surveyPreset } from './presets.ts';
import type { Answers } from '../../types/forms.ts';

/** 정규 학기 신청서를 끝까지 채운 한 벌 — 성인 수강생(학년 없음). */
const FILLED: Answers = {
  q1_reg_type: 'returning',
  q2_student_name: '김하늘',
  q3_grade: '',
  q4_email: 'sky@example.com',
  q4b_phone: '201-555-0100',
  q5_medical: '땅콩 알레르기',
  q6_period: 'm6',
  q7_classes: ['kids_dance', 'drums_3standing'],
  q8_perform: 'yes',
  q10_parade: true,
  q12_refund: true,
  q13_media: 'yes',
  q14_final: true,
};

test('고른 것만 추려서 누가·무엇을·얼마 동안 순으로 준다', () => {
  const { lines } = summarizeAnswers(seasonPreset2026(), FILLED, 'ko');
  assert.deepEqual(
    lines.map((l) => l.kind),
    ['identity', 'identity', 'class', 'period']
  );
  const byKey = new Map(lines.map((l) => [l.key, l]));
  assert.deepEqual(byKey.get('q1_reg_type')?.values, ['재등록']);
  assert.deepEqual(byKey.get('q2_student_name')?.values, ['김하늘']);
  assert.deepEqual(byKey.get('q6_period')?.values, ['6개월 등록 (수강료 10% 할인)']);
  assert.deepEqual(byKey.get('q7_classes')?.values, [
    '유년부 무용 (1:25~2:05 P.M.)',
    '삼고무 · 동고 3 Standing Drums (2:15~3:00 P.M.)',
  ]);
});

test('동의는 낱낱이 싣지 않고 세기만 한다 — 동의 문구가 통째로 라벨이라 요약이 신청서만큼 길어진다', () => {
  const { lines, consents } = summarizeAnswers(seasonPreset2026(), FILLED, 'ko');
  assert.ok(!lines.some((l) => l.key.startsWith('q1') && l.key !== 'q1_reg_type'));
  assert.ok(!lines.some((l) => ['q10_parade', 'q12_refund', 'q13_media', 'q14_final'].includes(l.key)));
  // 퍼레이드 · 환불정책 · 미디어 · 최종확인 4건 전부 답했다
  assert.deepEqual(consents, { total: 4, done: 4, firstMissingKey: null });
});

test('남은 동의가 있으면 첫 번째로 데려갈 문항을 알려준다', () => {
  const { consents } = summarizeAnswers(
    seasonPreset2026(),
    { ...FILLED, q10_parade: false, q14_final: false },
    'ko'
  );
  assert.deepEqual(consents, { total: 4, done: 2, firstMissingKey: 'q10_parade' });
});

test('연락처·건강 특이사항·자유 서술은 요약에 싣지 않는다', () => {
  const keys = summarizeAnswers(seasonPreset2026(), FILLED, 'ko').lines.map((l) => l.key);
  // 건강 정보를 요약에서 되풀이할 이유가 없다. 연락처는 위에서 바로 보이는 자리다.
  assert.ok(!keys.includes('q5_medical'));
  assert.ok(!keys.includes('q4b_phone'));
  assert.ok(!keys.includes('q4_email'));
  assert.ok(!keys.includes('info_tuition'));
});

test('화면에서 사라진 동의는 세지 않는다 — 고르지도 않은 것을 안 했다고 재촉하면 안 된다', () => {
  // 중고등부 작품반을 고르지 않았으므로 칼 소품비 동의(q11)는 화면에 없다.
  assert.equal(summarizeAnswers(seasonPreset2026(), FILLED, 'ko').consents?.total, 4);

  const withRepertoire = summarizeAnswers(
    seasonPreset2026(),
    { ...FILLED, q7_classes: ['youth_repertoire'] },
    'ko'
  );
  assert.equal(withRepertoire.consents?.total, 5);
  assert.equal(withRepertoire.consents?.firstMissingKey, 'q11_prop');
});

test('아직 고르지 않은 문항은 값이 빈 채로 남는다 — 무엇이 비었는지가 보여야 한다', () => {
  const { lines } = summarizeAnswers(seasonPreset2026(), { q2_student_name: '김하늘' }, 'ko');
  assert.deepEqual(lines.find((l) => l.key === 'q6_period')?.values, []);
  assert.deepEqual(lines.find((l) => l.key === 'q7_classes')?.values, []);
});

test('영어 화면에서는 영어 라벨로 — 번역이 없으면 한국어로 물러난다', () => {
  const { lines } = summarizeAnswers(seasonPreset2026(), FILLED, 'en');
  const byKey = new Map(lines.map((l) => [l.key, l]));
  assert.equal(byKey.get('q6_period')?.label, 'Registration Period');
  assert.deepEqual(byKey.get('q6_period')?.values, ['6-Month Program (10% Tuition Discount)']);
});

test('고를 것이 없는 신청서에는 요약을 띄우지 않는다', () => {
  assert.equal(hasSummary(summarizeAnswers(surveyPreset(), {}, 'ko')), false);
  assert.equal(hasSummary(summarizeAnswers(seasonPreset2026(), FILLED, 'ko')), true);
  // 아직 아무것도 고르지 않았어도 '고르는 자리'가 있으면 띄운다 — 무엇이 비었는지 보여준다.
  assert.equal(hasSummary(summarizeAnswers(seasonPreset2026(), {}, 'ko')), true);
});
