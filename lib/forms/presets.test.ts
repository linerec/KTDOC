/**
 * lib/forms/presets.test.ts — 프리셋을 잠근다
 *
 * 프리셋은 운영자가 "새 신청서"를 누를 때 나오는 시작점이다. 시작점이 게이트를
 * 통과하지 못하면 아무것도 만들 수 없다 — 그래서 여기서 못박는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COURSE, PRESETS, seasonPreset2026 } from './presets.ts';
import { allQuestions, applyBindings, validateAnswers, validateSchema } from './schema.ts';

test('모든 프리셋은 스키마 게이트를 통과한다', () => {
  for (const [kind, build] of Object.entries(PRESETS)) {
    assert.deepEqual(validateSchema(build()), [], `${kind} 프리셋이 게이트에 걸렸다`);
  }
});

test('정규 학기 프리셋은 원본 구글폼 14문항을 모두 담는다', () => {
  const keys = allQuestions(seasonPreset2026()).map((q) => q.key);
  for (const k of [
    'q1_reg_type',
    'q2_student_name',
    'q3_grade',
    'q4_email',
    'q4b_phone',
    'q4c_guardian',
    'q5_medical',
    'q6_period',
    'q7_classes',
    'q8_perform',
    'q9_reason',
    'q10_parade',
    'q11_prop',
    'q12_refund',
    'q13_media',
    'q14_final',
  ]) {
    assert.ok(keys.includes(k), `누락된 문항: ${k}`);
  }
});

test('전화는 필수, 보호자명은 선택 — 구글폼에 없던 두 문항을 새로 세운다', () => {
  const qs = allQuestions(seasonPreset2026());
  assert.equal(qs.find((q) => q.key === 'q4b_phone')?.required, true);
  assert.equal(qs.find((q) => q.key === 'q4c_guardian')?.required, false);
});

test('학년은 선택 — 성인 수강생이 제출하지 못하던 자리다', () => {
  // 이 신청서 하나를 유년부부터 일요 성인반까지 함께 쓴다. 학년을 필수로 두면
  // 성인은 적을 것이 없어 제출 자체가 막힌다.
  assert.equal(allQuestions(seasonPreset2026()).find((q) => q.key === 'q3_grade')?.required, false);
});

test('건강 문항은 민감으로 표시된다 — 목록·CSV에서 감춰지는 근거다', () => {
  assert.equal(allQuestions(seasonPreset2026()).find((q) => q.key === 'q5_medical')?.sensitive, true);
});

test('공연 미참가 사유는 조건부다 — 구글폼에서는 전원에게 떴다', () => {
  const q9 = allQuestions(seasonPreset2026()).find((q) => q.key === 'q9_reason');
  assert.deepEqual(q9?.showIf, { question: 'q8_perform', equals: ['no'] });
});

test('칼 소품비 동의는 중고등부 작품반을 고른 학생에게만 뜬다', () => {
  const q11 = allQuestions(seasonPreset2026()).find((q) => q.key === 'q11_prop');
  assert.deepEqual(q11?.showIf, { question: 'q7_classes', includes: ['youth_repertoire'] });
});

test('중고등부 작품반이 실제로 고를 수 있는 선택지로 존재한다 — 원본 폼의 결함을 고친 자리', () => {
  // 원본 구글폼은 Q11 에서 이 반을 가리키면서 Q7 에 선택지를 두지 않았다.
  const q7 = allQuestions(seasonPreset2026()).find((q) => q.key === 'q7_classes');
  const opt = q7?.options?.find((o) => o.key === 'youth_repertoire');
  assert.ok(opt, '중고등부 작품반 선택지가 없다 — Q11 의 조건부 노출이 영영 성립하지 않는다');
  assert.equal(opt?.programId, 15);
});

test('학비가 갈리는 과목은 선택지가 쪼개져 있다', () => {
  const q7 = allQuestions(seasonPreset2026()).find((q) => q.key === 'q7_classes');
  const byKey = new Map((q7?.options ?? []).map((o) => [o.key, o]));

  // 1 Drum $400 / 3 Drum $450
  assert.equal(byKey.get('nanta_1drum')?.courseCode, COURSE.KIDS_DRUM_1);
  assert.equal(byKey.get('nanta_3drum')?.courseCode, COURSE.KIDS_DRUM_3);
  // 삼고무·동고 $600 / 오고무 $700
  assert.equal(byKey.get('drums_3standing')?.courseCode, COURSE.DRUMS_3);
  assert.equal(byKey.get('drums_5standing')?.courseCode, COURSE.DRUMS_5);
});

test('모든 과목 선택지가 수업(programs)에 연결돼 있다 — 없으면 수강 배정 승격이 막힌다', () => {
  const q7 = allQuestions(seasonPreset2026()).find((q) => q.key === 'q7_classes');
  for (const o of q7?.options ?? []) {
    assert.ok(typeof o.programId === 'number', `수업 미연결: ${o.key}`);
  }
});

test('동의 5종이 모두 consentKey 를 갖는다 — 증빙 테이블로 승격되는 축이다', () => {
  const consents = allQuestions(seasonPreset2026())
    .map((q) => q.consentKey)
    .filter(Boolean);
  assert.deepEqual(
    [...consents].sort(),
    ['final', 'media_release', 'parade', 'prop_fee', 'refund_policy']
  );
});

test('특강 프리셋은 5필드로 끝난다 — 30초에 만들 수 있어야 한다', () => {
  const qs = allQuestions(PRESETS.workshop()).filter((q) => q.type !== 'info');
  assert.equal(qs.length, 5);
});

test('모든 문항과 선택지가 영문 라벨을 갖는다 — 이 폼은 한/영 병기가 기본이다', () => {
  for (const q of allQuestions(seasonPreset2026())) {
    assert.ok(q.label.en, `영문 라벨 없음: ${q.key}`);
    if (q.help) assert.ok(q.help.en, `영문 안내 없음: ${q.key}`);
    for (const o of q.options ?? []) {
      assert.ok(o.label.en, `영문 선택지 라벨 없음: ${q.key}.${o.key}`);
    }
  }
});

test('긴 안내문의 줄바꿈이 보존된다 — 불릿이 한 줄로 뭉치면 못 읽는다', () => {
  const q7 = allQuestions(seasonPreset2026()).find((q) => q.key === 'q7_classes');
  assert.ok(q7?.help?.ko.includes('\n'), '줄바꿈이 사라졌다');
  assert.ok(q7?.help?.ko.includes('삼고무·오고무'), '북 수량 안내가 빠졌다');
});

// ── 실제 제출 시나리오 ───────────────────────────────────────────

test('유년부 무용만 신청하면 칼 소품비를 묻지 않는다', () => {
  const schema = seasonPreset2026();
  const errors = validateAnswers(schema, {
    q1_reg_type: 'new',
    q2_student_name: '김하늘',
    q3_grade: '3학년',
    q4_email: 'a@b.com',
    q4b_phone: '917-555-0100',
    q6_period: 'y1',
    q7_classes: ['kids_dance'],
    q8_perform: 'yes',
    q10_parade: true,
    q12_refund: true,
    q13_media: 'yes',
    q14_final: true,
  });
  assert.deepEqual(errors, {}, `제출이 막혔다: ${JSON.stringify(errors)}`);
});

test('중고등부 작품반을 신청하면 칼 소품비 동의가 필수가 된다', () => {
  const schema = seasonPreset2026();
  const base = {
    q1_reg_type: 'returning',
    q2_student_name: '박바다',
    q3_grade: '9학년',
    q4_email: 'c@d.com',
    q4b_phone: '917-555-0200',
    q6_period: 'y1',
    q7_classes: ['youth_repertoire'],
    q8_perform: 'yes',
    q10_parade: true,
    q12_refund: true,
    q13_media: 'yes',
    q14_final: true,
  };
  assert.ok('q11_prop' in validateAnswers(schema, base), '칼 소품비를 묻지 않았다');
  assert.deepEqual(validateAnswers(schema, { ...base, q11_prop: 'agree' }), {});
});

test('공연에 참가하지 않으면 사유를 물어보되 필수는 아니다', () => {
  const schema = seasonPreset2026();
  const errors = validateAnswers(schema, {
    q1_reg_type: 'new',
    q2_student_name: '이바람',
    q3_grade: '1학년',
    q4_email: 'e@f.com',
    q4b_phone: '917-555-0300',
    q6_period: 'm3',
    q7_classes: ['nanta_1drum'],
    q8_perform: 'no',
    q10_parade: true,
    q12_refund: true,
    q13_media: 'no',
    q14_final: true,
  });
  // 원본 폼에서 Q9 는 선택 항목이었다 — 그대로 둔다
  assert.deepEqual(errors, {});
});

test('제출하면 동의 5종 중 해당되는 것만 증빙으로 남는다', () => {
  const schema = seasonPreset2026();
  const { consents, selections } = applyBindings(
    schema,
    {
      q2_student_name: '최달',
      q4_email: 'g@h.com',
      q4b_phone: '917-555-0400',
      q6_period: 'y1',
      q7_classes: ['kids_dance', 'drums_5standing'],
      q8_perform: 'yes',
      q10_parade: true,
      q12_refund: true,
      q13_media: 'no',
      q14_final: true,
    },
    1
  );

  // 중고등부 작품반을 안 골랐으니 prop_fee 는 없다
  assert.deepEqual(
    consents.map((c) => c.consent_key).sort(),
    ['final', 'media_release', 'parade', 'refund_policy']
  );
  // 미디어 동의를 거부했다 — 이 값이 프로필의 공개 아카이브 동의로 내려간다
  assert.equal(consents.find((c) => c.consent_key === 'media_release')?.agreed, 0);
  // 선택 과목 2건이 명단의 축이 된다
  assert.deepEqual(selections.map((s) => s.option_key).sort(), ['drums_5standing', 'kids_dance']);
  assert.equal(selections.find((s) => s.option_key === 'drums_5standing')?.program_id, 14);
});
