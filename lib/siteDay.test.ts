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

import { dayInTimeZone, siteDayUtcRange } from './siteDay.ts';

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

// ── siteDayUtcRange: 학원 기준 하루의 UTC 구간 ─────────────────────────────
// 메일 발송량을 "오늘 몇 통"으로 셀 때 쓴다. 이 경계가 틀리면 저녁에 찍힌
// 발송이 다음 날로 세어져 게이지가 실제 잔량과 어긋난다.

test('여름(EDT, UTC-4): 뉴저지 하루는 UTC 04:00에 시작한다', () => {
  const { start, end } = siteDayUtcRange('2026-08-17', 'America/New_York');
  assert.equal(start, '2026-08-17 04:00:00');
  assert.equal(end, '2026-08-18 04:00:00');
});

test('겨울(EST, UTC-5): 같은 하루가 UTC 05:00에 시작한다', () => {
  const { start, end } = siteDayUtcRange('2026-01-15', 'America/New_York');
  assert.equal(start, '2026-01-15 05:00:00');
  assert.equal(end, '2026-01-16 05:00:00');
});

test('구간은 정확히 24시간이다', () => {
  const { start, end } = siteDayUtcRange('2026-08-17', 'America/New_York');
  const ms = new Date(`${end.replace(' ', 'T')}Z`).getTime()
    - new Date(`${start.replace(' ', 'T')}Z`).getTime();
  assert.equal(ms, 24 * 60 * 60 * 1000);
});

test('UTC 시간대면 구간이 그대로다', () => {
  const { start, end } = siteDayUtcRange('2026-08-17', 'UTC');
  assert.equal(start, '2026-08-17 00:00:00');
  assert.equal(end, '2026-08-18 00:00:00');
});

test('학원 저녁은 UTC로 다음 날이지만 같은 하루에 든다', () => {
  // 뉴저지 8/17 20:00 EDT = UTC 8/18 00:00 — 접두사 비교였다면 빠졌을 순간
  const { start, end } = siteDayUtcRange('2026-08-17', 'America/New_York');
  const eveningUtc = '2026-08-18 00:00:00';
  assert.ok(eveningUtc >= start && eveningUtc < end);
});
