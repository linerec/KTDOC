/**
 * lib/print/bannerConfirm.test.ts — 회신 한 통의 계약을 잠근다
 *
 * 이 회신은 저장되지 않는다. 메일 한 통이 전부다.
 * 그래서 다음이 무너지면 회신이 그냥 사라지거나, 사라진 줄도 모른다:
 *  - 아무것도 안 적었는데 "보냈습니다"가 뜬다(빈 메일이 학원에 간다)
 *  - 적으신 말이 메일에 실리지 않는다
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBannerFeedback, NOTE_MAX } from './bannerConfirm.ts';

test('적으신 말이 그대로 담긴다', () => {
  const parsed = parseBannerFeedback({ note: '북 배너는 두 장 필요합니다.' });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.note, '북 배너는 두 장 필요합니다.');
});

test('빈 회신은 거부한다 — 빈 메일을 보내지 않는다', () => {
  assert.equal(parseBannerFeedback({ note: '' }).ok, false);
  assert.equal(parseBannerFeedback({}).ok, false);
});

test('공백만 적은 것도 빈 회신이다', () => {
  assert.equal(parseBannerFeedback({ note: '   \n  ' }).ok, false);
});

test('너무 긴 회신은 거부한다', () => {
  assert.equal(parseBannerFeedback({ note: 'ㄱ'.repeat(NOTE_MAX + 1) }).ok, false);
});

test('한도만큼은 받는다', () => {
  assert.equal(parseBannerFeedback({ note: 'ㄱ'.repeat(NOTE_MAX) }).ok, true);
});

test('앞뒤 공백은 지운다', () => {
  const parsed = parseBannerFeedback({ note: '  치수는 28인치입니다.  ' });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.note, '치수는 28인치입니다.');
});

test('줄바꿈은 지우지 않는다 — 여러 줄로 적으실 수 있다', () => {
  const parsed = parseBannerFeedback({ note: '첫째 줄\n둘째 줄' });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.note, '첫째 줄\n둘째 줄');
});

test('문자열이 아닌 것은 빈 회신으로 본다', () => {
  assert.equal(parseBannerFeedback({ note: 12345 }).ok, false);
  assert.equal(parseBannerFeedback({ note: { a: 1 } }).ok, false);
  assert.equal(parseBannerFeedback(null).ok, false);
});

/**
 * 폼은 텍스트 한 칸으로 줄었다(2026-08-30). 고르는 질문·치수 칸·보내는 분은
 * 없앴다 — 원장님께 항목을 채우게 하는 화면이 실례라는 판단이다.
 * 옛 화면이 캐시된 브라우저에서 뒤늦게 날아오는 제출이 "회신"으로 성립하면 안 된다.
 */
test('옛 폼의 항목만으로는 회신이 되지 않는다', () => {
  assert.equal(
    parseBannerFeedback({
      choices: { layout: 'keep' },
      sizes: { parade_w: '28' },
      sender: '안은희',
    }).ok,
    false
  );
});
