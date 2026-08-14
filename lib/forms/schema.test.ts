/**
 * lib/forms/schema.test.ts — 신청서 스키마 엔진의 불변식을 잠근다
 *
 * 이 시험이 지키는 것은 함수가 아니라 **설계의 선**이다.
 * 이 도메인의 사고는 조용하다: bind 를 잘못 적으면 폼은 멀쩡히 돌아가는데
 * 명단이 안 나오고, 선택지를 지우면 이미 낸 응답이 가리킬 곳을 잃는다.
 * 그래서 게이트가 무엇을 막고 무엇을 통과시키는지를 여기서 못박는다.
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 상대 경로 + .ts 로 import 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBindings,
  assertEditAllowed,
  evaluateShowIf,
  normalizeEmail,
  normalizeName,
  validateAnswers,
  validateSchema,
  visibleQuestions,
  warnSchema,
} from './schema.ts';
import type { Answers, FormQuestion, FormSchema } from '../../types/forms.ts';

/** 최소 유효 스키마 — 각 시험이 필요한 것만 덧댄다. */
function baseSchema(questions: FormQuestion[]): FormSchema {
  return { version: 1, sections: [{ key: 's1', questions }] };
}

// ── validateSchema: 차단 항목 ────────────────────────────────────

test('문항 key 가 중복되면 저장을 거부한다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'short', required: true, label: { ko: 'A' } },
    { key: 'q1', type: 'short', required: false, label: { ko: 'B' } },
  ]);
  const errs = validateSchema(s);
  assert.ok(errs.some((e) => e.includes('q1')), `중복 키를 잡아야 한다: ${JSON.stringify(errs)}`);
});

test('문항 key 가 비ASCII 이거나 비어 있으면 거부한다', () => {
  // 키는 URL·CSV 헤더·SQL 파라미터를 오간다. 안전한 문자만 허용한다.
  assert.ok(
    validateSchema(baseSchema([{ key: '학생', type: 'short', required: true, label: { ko: 'A' } }])).length > 0
  );
  assert.ok(
    validateSchema(baseSchema([{ key: '', type: 'short', required: true, label: { ko: 'A' } }])).length > 0
  );
});

test('CORE_BIND_KEYS 에 없는 bind 는 거부한다 — 코어 컬럼은 코드로만 늘린다', () => {
  const s = baseSchema([
    // @ts-expect-error 의도적으로 잘못된 bind
    { key: 'q1', type: 'short', required: true, label: { ko: 'A' }, bind: 'nickname' },
  ]);
  assert.ok(validateSchema(s).some((e) => e.includes('bind')));
});

test('같은 bind 를 두 문항이 쓰면 거부한다 — 어느 답이 컬럼에 갈지 모호해진다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'short', required: true, label: { ko: 'A' }, bind: 'email' },
    { key: 'q2', type: 'short', required: true, label: { ko: 'B' }, bind: 'email' },
  ]);
  assert.ok(validateSchema(s).some((e) => e.includes('email')));
});

test('consentKey 가 중복되면 거부한다 — 동의 증빙이 덮어써진다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'consent', required: true, label: { ko: 'A' }, consentKey: 'final' },
    { key: 'q2', type: 'consent', required: true, label: { ko: 'B' }, consentKey: 'final' },
  ]);
  assert.ok(validateSchema(s).some((e) => e.includes('final')));
});

test('showIf 가 없는 문항·선택지를 가리키면 거부한다 — 영영 안 보이는 문항이 생긴다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'single', required: true, label: { ko: 'A' }, options: [{ key: 'yes', label: { ko: '예' } }] },
    { key: 'q2', type: 'long', required: false, label: { ko: 'B' }, showIf: { question: 'qx', equals: ['no'] } },
  ]);
  assert.ok(validateSchema(s).some((e) => e.includes('qx')));

  const s2 = baseSchema([
    { key: 'q1', type: 'single', required: true, label: { ko: 'A' }, options: [{ key: 'yes', label: { ko: '예' } }] },
    { key: 'q2', type: 'long', required: false, label: { ko: 'B' }, showIf: { question: 'q1', equals: ['nope'] } },
  ]);
  assert.ok(validateSchema(s2).some((e) => e.includes('nope')));
});

test('같은 문항 안 선택지 key 가 중복되면 거부한다', () => {
  const s = baseSchema([
    {
      key: 'q1', type: 'multi', required: true, label: { ko: 'A' },
      options: [{ key: 'a', label: { ko: 'A' } }, { key: 'a', label: { ko: 'B' } }],
    },
  ]);
  assert.ok(validateSchema(s).length > 0);
});

test('minSelect 가 선택지 수보다 크면 거부한다 — 제출 불가능한 폼이 된다', () => {
  const s = baseSchema([
    {
      key: 'q1', type: 'multi', required: true, minSelect: 3, label: { ko: 'A' },
      options: [{ key: 'a', label: { ko: 'A' } }, { key: 'b', label: { ko: 'B' } }],
    },
  ]);
  assert.ok(validateSchema(s).length > 0);
});

test("format:'email' 은 short 문항에만 붙일 수 있다", () => {
  const s = baseSchema([{ key: 'q1', type: 'long', required: true, label: { ko: 'A' }, format: 'email' }]);
  assert.ok(validateSchema(s).length > 0);
});

test('정상 스키마는 통과한다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'short', required: true, label: { ko: '이름' }, bind: 'student_name' },
    { key: 'q2', type: 'single', required: true, label: { ko: '기간' }, options: [{ key: 'm3', label: { ko: '3개월' } }] },
  ]);
  assert.deepEqual(validateSchema(s), []);
});

// ── warnSchema: 게시는 되지만 알려야 하는 것 ─────────────────────

test('수업이 연결되지 않은 과목은 경고한다 — 폼은 도는데 명단이 안 나오는 조용한 실패', () => {
  const s = baseSchema([
    {
      key: 'q7', type: 'multi', required: true, selectionOf: 'class', label: { ko: '과목' },
      options: [
        { key: 'a', label: { ko: '가' }, programId: 12, capacity: 10, courseCode: 'x' },
        { key: 'b', label: { ko: '나' } },
      ],
    },
  ]);
  const warns = warnSchema(s);
  assert.ok(warns.some((w) => w.includes('수강 배정')), JSON.stringify(warns));
  // 경고는 저장을 막지 않는다
  assert.deepEqual(validateSchema(s), []);
});

// ── 조건부 노출 · 답변 검증 ──────────────────────────────────────

const CONDITIONAL: FormSchema = {
  version: 1,
  sections: [
    {
      key: 's',
      questions: [
        {
          key: 'q8_perform', type: 'single', required: true, label: { ko: '공연 참가' },
          options: [{ key: 'yes', label: { ko: '예' } }, { key: 'no', label: { ko: '아니오' } }],
        },
        {
          key: 'q9_reason', type: 'long', required: true, label: { ko: '사유' },
          showIf: { question: 'q8_perform', equals: ['no'] },
        },
        {
          key: 'q7_classes', type: 'multi', required: true, minSelect: 1, selectionOf: 'class', label: { ko: '과목' },
          options: [
            { key: 'kids_dance', label: { ko: '유년부 무용' }, programId: 13 },
            { key: 'youth_repertoire', label: { ko: '중고등부 작품반' }, programId: 15 },
          ],
        },
        {
          key: 'q11_prop', type: 'single', required: true, consentKey: 'prop_fee', label: { ko: '소품비' },
          showIf: { question: 'q7_classes', includes: ['youth_repertoire'] },
          options: [
            { key: 'agree', label: { ko: '동의' }, consentValue: true },
            { key: 'na', label: { ko: '해당 없음' }, consentValue: false, exclusive: true },
          ],
        },
      ],
    },
  ],
};

test('equals 조건은 값이 일치할 때만 문항을 보여준다', () => {
  const q9 = CONDITIONAL.sections[0].questions[1];
  assert.equal(evaluateShowIf(q9, { q8_perform: 'no' }), true);
  assert.equal(evaluateShowIf(q9, { q8_perform: 'yes' }), false);
  // 아직 답하지 않았으면 보여주지 않는다 — 빈 화면에 사유부터 묻지 않는다
  assert.equal(evaluateShowIf(q9, {}), false);
});

test('includes 조건은 다중선택 안에 그 선택지가 있을 때만 보여준다', () => {
  const q11 = CONDITIONAL.sections[0].questions[3];
  assert.equal(evaluateShowIf(q11, { q7_classes: ['youth_repertoire'] }), true);
  assert.equal(evaluateShowIf(q11, { q7_classes: ['kids_dance'] }), false);
  assert.equal(evaluateShowIf(q11, { q7_classes: ['kids_dance', 'youth_repertoire'] }), true);
});

test('숨겨진 문항은 필수 검증에서 제외된다 — 이것이 구글폼이 못 하던 것이다', () => {
  // 공연에 참가하면 사유(q9)는 필수가 아니다. 구글폼에서는 전원에게 필수로 떴다.
  const errs = validateAnswers(CONDITIONAL, {
    q8_perform: 'yes', q7_classes: ['kids_dance'],
  });
  assert.ok(!('q9_reason' in errs), `숨겨진 문항이 필수로 잡혔다: ${JSON.stringify(errs)}`);
  // q11 도 중고등부 작품반을 안 골랐으니 묻지 않는다
  assert.ok(!('q11_prop' in errs));
});

test('보이는 필수 문항이 비면 오류를 낸다', () => {
  const errs = validateAnswers(CONDITIONAL, { q8_perform: 'no', q7_classes: ['kids_dance'] });
  assert.ok('q9_reason' in errs);
});

test('multi 의 minSelect 미달은 오류다', () => {
  const errs = validateAnswers(CONDITIONAL, { q8_perform: 'yes', q7_classes: [] });
  assert.ok('q7_classes' in errs);
});

test('선택지에 없는 값을 보내면 오류다 — 조작된 제출을 막는다', () => {
  const errs = validateAnswers(CONDITIONAL, { q8_perform: 'maybe', q7_classes: ['kids_dance'] });
  assert.ok('q8_perform' in errs);

  const errs2 = validateAnswers(CONDITIONAL, { q8_perform: 'yes', q7_classes: ['해킹'] });
  assert.ok('q7_classes' in errs2);
});

test('visibleQuestions 는 지금 화면에 떠야 할 문항만 준다', () => {
  const keys = visibleQuestions(CONDITIONAL, { q8_perform: 'yes', q7_classes: ['kids_dance'] }).map((q) => q.key);
  assert.deepEqual(keys, ['q8_perform', 'q7_classes']);
});

test('이메일·전화 형식을 검사한다', () => {
  const s = baseSchema([
    { key: 'e', type: 'short', required: true, label: { ko: '메일' }, format: 'email' },
    { key: 'p', type: 'short', required: true, label: { ko: '전화' }, format: 'tel' },
  ]);
  const errs = validateAnswers(s, { e: 'not-an-email', p: '123' });
  assert.ok('e' in errs);
  assert.ok('p' in errs);
  assert.deepEqual(validateAnswers(s, { e: 'a@b.com', p: '917-555-0100' }), {});
});

// ── applyBindings: 파생 유도 ─────────────────────────────────────

test('applyBindings 는 코어 컬럼·선택 파생·동의 파생을 정확히 만든다', () => {
  const answers: Answers = {
    q8_perform: 'yes',
    q7_classes: ['kids_dance', 'youth_repertoire'],
    q11_prop: 'agree',
  };
  const out = applyBindings(CONDITIONAL, answers, 3);

  // 선택 축: 라벨과 programId 를 스냅샷한다 — CSV·명단이 스키마를 안 읽고도 성립해야 한다
  assert.equal(out.selections.length, 2);
  const yr = out.selections.find((s) => s.option_key === 'youth_repertoire');
  assert.equal(yr?.program_id, 15);
  assert.equal(yr?.option_label_ko, '중고등부 작품반');
  assert.equal(yr?.question_key, 'q7_classes');

  // 동의 축: consentValue 가 0/1 로 접힌다
  assert.equal(out.consents.length, 1);
  assert.equal(out.consents[0].consent_key, 'prop_fee');
  assert.equal(out.consents[0].agreed, 1);
  assert.equal(out.consents[0].policy_version, 3);
});

test('숨겨진 동의 문항은 파생을 만들지 않는다 — 안 본 것에 동의시키지 않는다', () => {
  // 중고등부 작품반을 안 골랐으면 q11(칼 소품비)은 화면에 없었다.
  const out = applyBindings(CONDITIONAL, { q8_perform: 'yes', q7_classes: ['kids_dance'] }, 1);
  assert.equal(out.consents.length, 0);
});

test('bind 가 붙은 문항의 답이 코어 컬럼으로 복사된다', () => {
  const s = baseSchema([
    { key: 'name', type: 'short', required: true, bind: 'student_name', label: { ko: '이름' } },
    { key: 'mail', type: 'short', required: true, bind: 'email', format: 'email', label: { ko: '메일' } },
    { key: 'tel', type: 'short', required: true, bind: 'phone', format: 'tel', label: { ko: '전화' } },
  ]);
  const out = applyBindings(s, { name: '  김하늘 ', mail: 'A@B.com', tel: '917-555-0100' }, 1);
  assert.equal(out.core.student_name, '김하늘');
  assert.equal(out.core.email, 'A@B.com');
  assert.equal(out.core.email_norm, 'a@b.com');
  assert.equal(out.core.student_name_norm, '김하늘');
  assert.equal(out.core.phone, '917-555-0100');
});

test('민감 문항에 값이 있으면 has_medical 이 선다 — 내용은 여기서 다루지 않는다', () => {
  const s = baseSchema([{ key: 'med', type: 'long', required: false, sensitive: true, label: { ko: '건강' } }]);
  assert.equal(applyBindings(s, { med: '땅콩 알레르기' }, 1).hasMedical, true);
  assert.equal(applyBindings(s, { med: '   ' }, 1).hasMedical, false);
  assert.equal(applyBindings(s, {}, 1).hasMedical, false);
});

test('이름 정규화는 공백을 지우고 소문자로 — 중복 판정의 키다', () => {
  assert.equal(normalizeName(' 김 하늘 '), '김하늘');
  assert.equal(normalizeName('Kim  Haneul'), 'kimhaneul');
  assert.equal(normalizeEmail('  A@B.COM '), 'a@b.com');
});

// ── assertEditAllowed: 첫 제출 이후 잠금 ─────────────────────────

const LOCKED_BEFORE: FormSchema = {
  version: 1,
  sections: [
    {
      key: 's',
      questions: [
        {
          key: 'q1', type: 'single', required: false, label: { ko: 'A' },
          options: [{ key: 'a', label: { ko: 'A' } }, { key: 'b', label: { ko: 'B' } }],
        },
        { key: 'q2', type: 'short', required: false, label: { ko: 'B' }, bind: 'email' },
      ],
    },
  ],
};

function withQuestions(qs: FormQuestion[]): FormSchema {
  return { version: 1, sections: [{ key: 's', questions: qs }] };
}

test('첫 제출 이후에는 문항을 지울 수 없다 — 이미 낸 응답이 가리킬 곳을 잃는다', () => {
  const after = withQuestions([LOCKED_BEFORE.sections[0].questions[0]]);
  assert.ok(assertEditAllowed(LOCKED_BEFORE, after, true).some((e) => e.includes('q2')));
  // 잠기기 전이면 자유롭다
  assert.deepEqual(assertEditAllowed(LOCKED_BEFORE, after, false), []);
});

test('첫 제출 이후에는 선택지를 지울 수 없다', () => {
  const after = withQuestions([
    { key: 'q1', type: 'single', required: false, label: { ko: 'A' }, options: [{ key: 'a', label: { ko: 'A' } }] },
    LOCKED_BEFORE.sections[0].questions[1],
  ]);
  assert.ok(assertEditAllowed(LOCKED_BEFORE, after, true).some((e) => e.includes('b')));
});

test('첫 제출 이후에는 문항 유형·bind·consentKey 를 바꿀 수 없다', () => {
  const typeChanged = withQuestions([
    { ...LOCKED_BEFORE.sections[0].questions[0], type: 'multi' },
    LOCKED_BEFORE.sections[0].questions[1],
  ]);
  assert.ok(assertEditAllowed(LOCKED_BEFORE, typeChanged, true).length > 0);

  const bindChanged = withQuestions([
    LOCKED_BEFORE.sections[0].questions[0],
    { ...LOCKED_BEFORE.sections[0].questions[1], bind: 'phone' as const },
  ]);
  assert.ok(assertEditAllowed(LOCKED_BEFORE, bindChanged, true).length > 0);
});

test('required 를 켜는 것은 막고, 끄는 것은 허용한다 — 소급 무효를 막되 운영자를 가두지 않는다', () => {
  const turnedOn = withQuestions([
    { ...LOCKED_BEFORE.sections[0].questions[0], required: true },
    LOCKED_BEFORE.sections[0].questions[1],
  ]);
  assert.ok(assertEditAllowed(LOCKED_BEFORE, turnedOn, true).length > 0);

  const alreadyRequired = withQuestions([
    { ...LOCKED_BEFORE.sections[0].questions[0], required: true },
    LOCKED_BEFORE.sections[0].questions[1],
  ]);
  const turnedOff = withQuestions([
    { ...LOCKED_BEFORE.sections[0].questions[0], required: false },
    LOCKED_BEFORE.sections[0].questions[1],
  ]);
  assert.deepEqual(assertEditAllowed(alreadyRequired, turnedOff, true), []);
});

test('문항 추가·선택지 추가·문구 수정은 잠긴 뒤에도 허용한다', () => {
  const added = withQuestions([
    {
      ...LOCKED_BEFORE.sections[0].questions[0],
      label: { ko: '고친 문구' },
      options: [
        { key: 'a', label: { ko: 'A' } },
        { key: 'b', label: { ko: 'B' } },
        { key: 'c', label: { ko: 'C' } },
      ],
    },
    LOCKED_BEFORE.sections[0].questions[1],
    { key: 'q3', type: 'long', required: false, label: { ko: '새 문항' } },
  ]);
  assert.deepEqual(assertEditAllowed(LOCKED_BEFORE, added, true), []);
});

test('retired 툼스톤은 삭제로 치지 않는다 — 지우는 대신 감추는 길', () => {
  const tombstoned = withQuestions([
    LOCKED_BEFORE.sections[0].questions[0],
    { ...LOCKED_BEFORE.sections[0].questions[1], retired: true },
  ]);
  assert.deepEqual(assertEditAllowed(LOCKED_BEFORE, tombstoned, true), []);
});

test('retired 문항은 화면에서도 사라진다 — 툼스톤은 렌더 대상이 아니다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'short', required: false, label: { ko: 'A' }, retired: true },
    { key: 'q2', type: 'short', required: false, label: { ko: 'B' } },
  ]);
  assert.deepEqual(visibleQuestions(s, {}).map((q) => q.key), ['q2']);
});

// ── 오류는 문장이 아니라 코드다 ──────────────────────────────────

test('검증 오류는 문장이 아니라 코드를 돌려준다 — 영문 화면이 스스로 번역해야 한다', () => {
  const s = baseSchema([
    { key: 'name', type: 'short', required: true, label: { ko: '이름' } },
    { key: 'mail', type: 'short', required: true, label: { ko: '메일' }, format: 'email' },
    { key: 'tel', type: 'short', required: true, label: { ko: '전화' }, format: 'tel' },
    { key: 'pick', type: 'single', required: true, label: { ko: '고르기' },
      options: [{ key: 'a', label: { ko: 'A' } }] },
    { key: 'many', type: 'multi', required: true, minSelect: 2, label: { ko: '여럿' },
      options: [{ key: 'x', label: { ko: 'X' } }, { key: 'y', label: { ko: 'Y' } }] },
    { key: 'ok', type: 'consent', required: true, label: { ko: '동의' } },
  ]);

  const errs = validateAnswers(s, { mail: 'nope', tel: '1', many: ['x'] });
  assert.equal(errs.name.code, 'required');
  assert.equal(errs.mail.code, 'badEmail');
  assert.equal(errs.tel.code, 'badTel');
  assert.equal(errs.pick.code, 'selectRequired');
  assert.equal(errs.many.code, 'pickAtLeast');
  assert.equal(errs.many.min, 2, '몇 개가 필요한지 함께 넘겨야 문장을 만들 수 있다');
  assert.equal(errs.ok.code, 'consentRequired');

  // 어느 값에도 한국어가 섞여 있으면 안 된다 — 그게 영문 화면을 깨뜨렸다.
  const dump = JSON.stringify(errs);
  assert.ok(!/[가-힣]/.test(dump), `오류 값에 한국어가 남아 있다: ${dump}`);
});

test('하나만 필요할 때는 pickOne, 여럿일 때는 pickAtLeast', () => {
  const one = baseSchema([
    { key: 'm', type: 'multi', required: true, label: { ko: 'M' },
      options: [{ key: 'a', label: { ko: 'A' } }] },
  ]);
  assert.equal(validateAnswers(one, {}).m.code, 'pickOne');
});

test('없는 선택지를 보내면 badOption / badOptions', () => {
  const s = baseSchema([
    { key: 'one', type: 'single', required: true, label: { ko: '단일' },
      options: [{ key: 'a', label: { ko: 'A' } }] },
    { key: 'many', type: 'multi', required: true, label: { ko: '다중' },
      options: [{ key: 'a', label: { ko: 'A' } }] },
  ]);
  const errs = validateAnswers(s, { one: 'zzz', many: ['zzz'] });
  assert.equal(errs.one.code, 'badOption');
  assert.equal(errs.many.code, 'badOptions');
});
