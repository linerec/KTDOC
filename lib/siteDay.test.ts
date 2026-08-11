/**
 * 학원 기준 '오늘' 시험
 *
 *   node --test lib/siteDay.test.ts
 *
 * 여기서 잠그는 것은 **날짜 경계**다. 뉴저지 저녁이면 UTC로는 이미 다음 날이라,
 * UTC로 오늘을 정하면 행사 당일 저녁에 "오늘의 무대" 배너가 사라진다.
 * 그 순간들을 실제 시각으로 박아 둔다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dayInTimeZone } from './siteDay.ts';

const NJ = 'America/New_York';

test('뉴저지 저녁 8시 — UTC로는 다음 날이지만 학원은 아직 오늘', () => {
  // 2026-08-11 20:00 EDT = 2026-08-12 00:00 UTC
  const at = new Date('2026-08-12T00:00:00Z');
  assert.equal(at.toISOString().slice(0, 10), '2026-08-12', '전제: UTC로는 12일');
  assert.equal(dayInTimeZone(at, NJ), '2026-08-11');
});

test('뉴저지 자정 직후 — 그제야 날짜가 넘어간다', () => {
  // 2026-08-12 00:30 EDT = 2026-08-12 04:30 UTC
  assert.equal(dayInTimeZone(new Date('2026-08-12T04:30:00Z'), NJ), '2026-08-12');
});

test('뉴저지 자정 직전 — 아직 전날', () => {
  // 2026-08-11 23:59 EDT = 2026-08-12 03:59 UTC
  assert.equal(dayInTimeZone(new Date('2026-08-12T03:59:00Z'), NJ), '2026-08-11');
});

test('겨울(EST, UTC-5)에도 경계가 맞는다 — 서머타임을 손으로 계산하지 않는다', () => {
  // 2026-01-15 19:00 EST = 2026-01-16 00:00 UTC
  assert.equal(dayInTimeZone(new Date('2026-01-16T00:00:00Z'), NJ), '2026-01-15');
});

test('한 자리 월·일도 0을 채운다 — 문자열 비교로 날짜를 맞추기 때문', () => {
  const day = dayInTimeZone(new Date('2026-03-05T18:00:00Z'), NJ);
  assert.equal(day, '2026-03-05');
  assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
});

test('다른 시간대를 주면 그 시간대로 판단한다 — 학원이 이사해도 설정만 바꾸면 된다', () => {
  const at = new Date('2026-08-11T20:00:00Z');
  assert.equal(dayInTimeZone(at, 'Asia/Seoul'), '2026-08-12'); // 서울은 다음 날 새벽 5시
  assert.equal(dayInTimeZone(at, 'UTC'), '2026-08-11');
});
