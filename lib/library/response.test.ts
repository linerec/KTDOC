/**
 * 공연 참여 응답 시험
 *
 *   node --test lib/library/response.test.ts
 *
 * 잠그는 것: 참여가 불참을 이긴다 / 말하지 않은 POST는 참여다 / 불참도 응답이다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isAwaitingResponse, parseResponse, responseOf } from './response.ts';
import { libraryCardId, libraryEventHref } from './anchor.ts';

test('참여·불참이 둘 다 남아 있으면 참여가 이긴다', () => {
  assert.equal(responseOf(true, true), 'going');
  assert.equal(responseOf(true, false), 'going');
  assert.equal(responseOf(false, true), 'declined');
  assert.equal(responseOf(false, false), null);
});

test('response를 말하지 않은 POST는 참여다 — 옛 호출부 호환', () => {
  assert.equal(parseResponse(undefined), 'going');
  assert.equal(parseResponse(null), 'going');
  assert.equal(parseResponse(''), 'going');
  assert.equal(parseResponse('going'), 'going');
  assert.equal(parseResponse('declined'), 'declined');
});

test('알 수 없는 값은 조용히 참여가 되지 않는다', () => {
  assert.equal(parseResponse('decline'), null);
  assert.equal(parseResponse('yes'), null);
  assert.equal(parseResponse(1), null);
});

test('불참도 응답이다 — 안내에서 빠진다', () => {
  assert.equal(isAwaitingResponse(true, false, false), true);
  assert.equal(isAwaitingResponse(true, false, true), false);
  assert.equal(isAwaitingResponse(true, true, false), false);
});

test('지난 공연은 응답을 기다리지 않는다', () => {
  assert.equal(isAwaitingResponse(false, false, false), false);
});

test('알림 주소는 카드 id를 가리킨다', () => {
  assert.equal(libraryCardId(42), 'event-42');
  assert.equal(libraryEventHref(42), '/admin/library#event-42');
  assert.ok(libraryEventHref(7).endsWith(`#${libraryCardId(7)}`));
});
