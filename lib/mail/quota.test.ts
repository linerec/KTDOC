/**
 * lib/mail/quota.test.ts — "보낼 수 있는가"를 잠근다
 *
 * Resend 무료의 하루 100통은 하드 캡이고(초과분 과금이 아니라 그냥 막힘),
 * To·CC·BCC의 각 수신자를 1통으로 센다. 그래서 판정 단위가 '수신자 수'다.
 * 이 단위가 '요청 수'로 바뀌면 화면은 "12통"인데 provider는 429를 준다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideQuota, quotaPercent } from './quota.ts';

const limits = { dailyLimit: 100, monthlyLimit: 3000, warnAtPercent: 80 };

test('여유가 있으면 보낸다', () => {
  const d = decideQuota({ dailySent: 10, monthlySent: 200 }, limits, 5, false);
  assert.equal(d.allow, true);
  assert.equal(d.warn, false);
});

test('경고 임계를 넘으면 보내되 warn이 선다', () => {
  const d = decideQuota({ dailySent: 79, monthlySent: 200 }, limits, 2, false);
  assert.equal(d.allow, true);
  assert.equal(d.warn, true);
});

test('일일 한도를 넘기면 막는다', () => {
  const d = decideQuota({ dailySent: 98, monthlySent: 200 }, limits, 5, false);
  assert.equal(d.allow, false);
  assert.equal(d.allow === false && d.reason, 'daily');
});

test('딱 맞으면 보낸다 — 경계는 초과일 때만 막는다', () => {
  const d = decideQuota({ dailySent: 95, monthlySent: 200 }, limits, 5, false);
  assert.equal(d.allow, true);
});

test('월 한도도 막는다', () => {
  const d = decideQuota({ dailySent: 1, monthlySent: 2999 }, limits, 5, false);
  assert.equal(d.allow, false);
  assert.equal(d.allow === false && d.reason, 'monthly');
});

test('필수 메일은 한도를 넘어도 보낸다', () => {
  const d = decideQuota({ dailySent: 100, monthlySent: 3000 }, limits, 1, true);
  assert.equal(d.allow, true);
});

test('단체 발송은 수신자 수만큼 한 번에 판정한다 — 일부만 보내지 않는다', () => {
  // 남은 자리 10, 수신자 30 → 전원 보류
  const d = decideQuota({ dailySent: 90, monthlySent: 200 }, limits, 30, false);
  assert.equal(d.allow, false);
  assert.equal(d.allow === false && d.reason, 'daily');
});

test('일일이 먼저 걸린다 — 두 한도가 동시에 넘칠 때', () => {
  const d = decideQuota({ dailySent: 100, monthlySent: 3000 }, limits, 1, false);
  assert.equal(d.allow, false);
  assert.equal(d.allow === false && d.reason, 'daily');
});

test('quotaPercent', () => {
  assert.equal(quotaPercent(50, 100), 50);
  assert.equal(quotaPercent(0, 100), 0);
  assert.equal(quotaPercent(150, 100), 100);
  assert.equal(quotaPercent(5, 0), 100);
});
