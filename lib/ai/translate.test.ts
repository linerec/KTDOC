/**
 * 한→영 초벌 번역의 입·출구 시험
 *
 *   node --test lib/ai/translate.test.ts
 *
 * 여기서 잠그는 것은 "번역이 잘 되었는가"가 아니다(모델의 일이다). **모델이
 * 엉뚱한 것을 돌려줬을 때 그것이 영문 칸에 그대로 꽂히지 않는가**다. 이 칸의 값은
 * 공연 전날 안내 메일로 학부모에게 나가므로, 조용히 잘못 채워지는 것이 가장 나쁘다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_FIELDS,
  MAX_FIELD_CHARS,
  TRANSLATE_SYSTEM,
  buildTranslatePrompt,
  normalizeFields,
  pickTranslations,
  type TranslateField,
} from './translate.ts';

/* ── 입구: 요청 정규화 ─────────────────────────────────────────────────── */

test('빈 원문·키 없는 항목은 버린다 — 보낼 것이 없는 칸이다', () => {
  const fields = normalizeFields([
    { key: 'title_en', label: '제목', ko: '추석잔치' },
    { key: 'description_en', label: '설명', ko: '   ' },
    { key: '', label: '이름없음', ko: '값은 있다' },
    { label: '키가 아예 없다', ko: '값은 있다' },
  ]);
  assert.deepEqual(
    fields.map((f) => f.key),
    ['title_en']
  );
});

test('같은 키가 두 번 오면 첫 것만 쓴다 — 어느 쪽을 채울지 모르게 두지 않는다', () => {
  const fields = normalizeFields([
    { key: 'title_en', label: '제목', ko: '먼저' },
    { key: 'title_en', label: '제목', ko: '나중' },
  ]);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].ko, '먼저');
});

test('라벨이 없으면 키를 라벨로 쓴다 — 모델에게 빈 라벨을 보내지 않는다', () => {
  const [field] = normalizeFields([{ key: 'prep_notes_en', ko: '검정 치마저고리 지참' }]);
  assert.equal(field.label, 'prep_notes_en');
});

test('원문이 너무 길면 자르고, 칸 수도 상한에서 멈춘다', () => {
  const long = normalizeFields([{ key: 'a_en', label: 'a', ko: '가'.repeat(MAX_FIELD_CHARS + 500) }]);
  assert.equal(long[0].ko.length, MAX_FIELD_CHARS);

  const many = normalizeFields(
    Array.from({ length: MAX_FIELDS + 5 }, (_, i) => ({ key: `k${i}`, label: 'x', ko: '값' }))
  );
  assert.equal(many.length, MAX_FIELDS);
});

test('배열이 아닌 것이 오면 빈 목록 — 라우트가 400으로 돌려보낼 근거가 된다', () => {
  assert.deepEqual(normalizeFields(null), []);
  assert.deepEqual(normalizeFields({ key: 'title_en', ko: '값' }), []);
  assert.deepEqual(normalizeFields('title_en'), []);
});

/* ── 프롬프트 ──────────────────────────────────────────────────────────── */

test('프롬프트는 키·라벨·원문을 모두 싣는다 — 라벨이 문맥이다', () => {
  const prompt = buildTranslatePrompt([
    { key: 'prep_notes_en', label: '준비물 · 복장 · 안내', ko: '모듬북 의상, 노메이크업' },
  ]);
  assert.match(prompt, /prep_notes_en/);
  assert.match(prompt, /준비물 · 복장 · 안내/);
  assert.match(prompt, /모듬북 의상, 노메이크업/);
});

test('칸 이름과 원문은 울타리로 갈라 둔다 — 라벨이 제목으로 번역돼 나온 적이 있다', () => {
  // 실제로 일어났다: 라벨 다음 줄에 본문을 붙였더니 모델이 라벨을 제목으로 읽고
  // "What to Bring · Attire · Information"을 번역문 맨 앞에 달아 돌려줬다.
  const prompt = buildTranslatePrompt([
    { key: 'prep_notes_en', label: '준비물 · 복장 · 안내', ko: '모듬북 의상, 노메이크업' },
  ]);
  // 머리말의 설명에도 울타리 표시가 나오므로, 마지막(= 실제 칸)을 본다.
  const body = prompt.slice(prompt.lastIndexOf('<<<원문>>>'), prompt.lastIndexOf('<<<끝>>>'));
  assert.match(body, /모듬북 의상, 노메이크업/);
  assert.doesNotMatch(body, /준비물 · 복장 · 안내/, '칸 이름이 원문 울타리 안에 들어가 있다');
  assert.match(TRANSLATE_SYSTEM, /칸 이름은 문맥을 알려 주는 표지/);
});

/* ── 출구: 응답 방어 ───────────────────────────────────────────────────── */

const FIELDS: TranslateField[] = [
  { key: 'title_en', label: '제목', ko: '추석잔치' },
  { key: 'prep_notes_en', label: '준비물', ko: '검정 치마저고리 지참' },
];

test('요청한 키만 통과한다 — 모델이 덧붙인 키는 폼에 꽂히지 않는다', () => {
  const out = pickTranslations(
    {
      title_en: 'Chuseok Festival',
      prep_notes_en: 'Bring the black hanbok.',
      notes: '모델이 제멋대로 붙인 칸',
      title_ko: '한국어 칸까지 돌려줬다',
    },
    FIELDS
  );
  assert.deepEqual(out, {
    title_en: 'Chuseok Festival',
    prep_notes_en: 'Bring the black hanbok.',
  });
});

test('문자열이 아닌 값·빈 문자열은 버린다 — 빈 칸이 덮이지 않는다', () => {
  const out = pickTranslations(
    { title_en: '', prep_notes_en: { text: 'Bring the hanbok' } },
    FIELDS
  );
  assert.deepEqual(out, {});
});

test('원문을 그대로 돌려준 칸은 번역이 아니다 — 한국어가 영문 칸에 앉는 것을 막는다', () => {
  // 실제로 일어나는 실패다: 모델이 지시를 놓치고 입력을 그대로 반사한다.
  // 통과시키면 영문 칸에 한국어가 들어앉고, 화면은 "영문 있음"으로 보인다.
  const out = pickTranslations({ title_en: '추석잔치', prep_notes_en: '  검정 치마저고리 지참  ' }, FIELDS);
  assert.deepEqual(out, {});
});

test('JSON이 객체가 아니면 아무것도 채우지 않는다', () => {
  assert.deepEqual(pickTranslations(['Chuseok Festival'], FIELDS), {});
  assert.deepEqual(pickTranslations('Chuseok Festival', FIELDS), {});
  assert.deepEqual(pickTranslations(null, FIELDS), {});
});

test('일부만 와도 그만큼 채운다 — 부분 성공을 실패로 만들지 않는다', () => {
  const out = pickTranslations({ prep_notes_en: 'Bring the black hanbok.' }, FIELDS);
  assert.deepEqual(out, { prep_notes_en: 'Bring the black hanbok.' });
});
