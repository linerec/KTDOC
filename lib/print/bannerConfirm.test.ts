/**
 * lib/print/bannerConfirm.test.ts — 회신 한 통의 계약을 잠근다
 *
 * 이 회신은 저장되지 않는다. 메일 한 통이 전부다.
 * 그래서 다음이 무너지면 회신이 그냥 사라지거나, 사라진 줄도 모른다:
 *  - 답을 하나도 안 골랐는데 "보냈습니다"가 뜬다(빈 메일이 학원에 간다)
 *  - 선택지에 없는 값이 그대로 메일에 실린다(봇 제출·오타가 답으로 읽힌다)
 *  - 메일 본문에 코드값('keep')이 찍힌다 — 받는 사람이 무슨 답인지 모른다
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANNER_QUESTIONS,
  parseBannerFeedback,
  formatBannerFeedback,
  NOTE_MAX,
  SHORT_MAX,
} from './bannerConfirm.ts';

test('고른 답만, 사람이 읽는 말로 본문에 담긴다', () => {
  const parsed = parseBannerFeedback({
    choices: { layout: 'keep', double_side: 'yes' },
    sizes: { parade_w: '28', parade_h: '28' },
    note: '',
    sender: '안은희',
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const body = formatBannerFeedback(parsed.value);
  assert.match(body, /3폭 배분/);
  assert.match(body, /기존 구성 유지/);
  assert.doesNotMatch(body, /keep/); // 코드값이 아니라 사람 말로
  assert.match(body, /28/);
  // 답하지 않은 질문은 본문에 나오지 않는다
  assert.doesNotMatch(body, /국기/);
});

test('선택지에 없는 값은 거부한다', () => {
  const parsed = parseBannerFeedback({
    choices: { layout: 'something-else' },
  });
  assert.equal(parsed.ok, false);
});

test('아무 답도 없으면 거부한다 — 빈 메일을 보내지 않는다', () => {
  const parsed = parseBannerFeedback({
    choices: {},
    sizes: {},
    note: '   ',
    sender: '안은희',
  });
  assert.equal(parsed.ok, false);
});

test('성함만으로는 회신이 되지 않는다', () => {
  const parsed = parseBannerFeedback({ sender: '안은희' });
  assert.equal(parsed.ok, false);
});

test('자유 의견 하나만 있어도 회신이 된다', () => {
  const parsed = parseBannerFeedback({ note: '북 배너는 두 장 필요합니다.' });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.match(formatBannerFeedback(parsed.value), /두 장 필요합니다/);
});

test('너무 긴 자유 의견은 거부한다', () => {
  const parsed = parseBannerFeedback({ note: 'ㄱ'.repeat(NOTE_MAX + 1) });
  assert.equal(parsed.ok, false);
});

test('치수 칸에 긴 글을 넣으면 거부한다', () => {
  const parsed = parseBannerFeedback({
    sizes: { parade_w: '2'.repeat(SHORT_MAX + 1) },
  });
  assert.equal(parsed.ok, false);
});

test('앞뒤 공백은 지운다', () => {
  const parsed = parseBannerFeedback({
    sizes: { parade_w: '  28  ' },
    sender: '  안은희  ',
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.sizes.parade_w, '28');
  assert.equal(parsed.value.sender, '안은희');
});

test('질문 정의에 중복 키가 없다', () => {
  const keys = BANNER_QUESTIONS.map((q) => q.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('모든 선택지 값이 서로 구별된다 — 한 질문 안에서', () => {
  for (const q of BANNER_QUESTIONS) {
    const values = q.options.map((o) => o.value);
    assert.equal(new Set(values).size, values.length, `${q.key}에 같은 값이 둘`);
  }
});
