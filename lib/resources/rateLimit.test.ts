import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAIL_WINDOW_MS,
  IP_BLOCK_MS,
  IP_FAIL_LIMIT,
  VAULT_BLOCK_MS,
  VAULT_FAIL_LIMIT,
  evaluateRateLimit,
  type FailureSample,
} from './rateLimit.ts';

const NOW = 1_700_000_000_000;
const IP = 'ipA';

function fails(count: number, ipHash: string | null, startOffset = -1000): FailureSample[] {
  return Array.from({ length: count }, (_, i) => ({ ipHash, at: NOW + startOffset - i * 1000 }));
}

test('실패가 없으면 통과한다', () => {
  const v = evaluateRateLimit({ now: NOW, ipHash: IP, failures: [] });
  assert.equal(v.blocked, false);
  assert.equal(v.reason, null);
  assert.equal(v.retryAfterMs, 0);
});

test('한도 직전까지는 통과한다 — 손이 미끄러진 사람을 막지 않는다', () => {
  const v = evaluateRateLimit({ now: NOW, ipHash: IP, failures: fails(IP_FAIL_LIMIT - 1, IP) });
  assert.equal(v.blocked, false);
});

test('같은 IP가 한도만큼 틀리면 막힌다', () => {
  const v = evaluateRateLimit({ now: NOW, ipHash: IP, failures: fails(IP_FAIL_LIMIT, IP) });
  assert.equal(v.blocked, true);
  assert.equal(v.reason, 'ip');
  assert.ok(v.retryAfterMs > 0 && v.retryAfterMs <= IP_BLOCK_MS);
});

test('남의 IP가 틀린 것으로는 내가 막히지 않는다', () => {
  const v = evaluateRateLimit({ now: NOW, ipHash: IP, failures: fails(IP_FAIL_LIMIT, 'ipB') });
  assert.equal(v.blocked, false);
});

test('창 밖의 실패는 세지 않는다 — 어제 틀린 것으로 오늘 막지 않는다', () => {
  const old: FailureSample[] = Array.from({ length: IP_FAIL_LIMIT + 5 }, (_, i) => ({
    ipHash: IP,
    at: NOW - FAIL_WINDOW_MS - 1000 - i * 1000,
  }));
  assert.equal(evaluateRateLimit({ now: NOW, ipHash: IP, failures: old }).blocked, false);
});

test('창 경계 — 정확히 창 안이면 세고, 창 밖이면 세지 않는다', () => {
  const inside = Array.from({ length: IP_FAIL_LIMIT }, () => ({
    ipHash: IP,
    at: NOW - FAIL_WINDOW_MS + 1,
  }));
  const outside = Array.from({ length: IP_FAIL_LIMIT }, () => ({
    ipHash: IP,
    at: NOW - FAIL_WINDOW_MS - 1,
  }));
  assert.equal(evaluateRateLimit({ now: NOW, ipHash: IP, failures: inside }).blocked, true);
  assert.equal(evaluateRateLimit({ now: NOW, ipHash: IP, failures: outside }).blocked, false);
});

test('여러 IP를 동원해 훑으면 자료함 전체가 잠긴다', () => {
  const many: FailureSample[] = Array.from({ length: VAULT_FAIL_LIMIT }, (_, i) => ({
    ipHash: `ip${i}`,
    at: NOW - 1000 - i,
  }));
  const v = evaluateRateLimit({ now: NOW, ipHash: 'freshIp', failures: many });
  assert.equal(v.blocked, true);
  assert.equal(v.reason, 'vault');
  assert.ok(v.retryAfterMs > 0 && v.retryAfterMs <= VAULT_BLOCK_MS);
});

test('IP 차단이 자료함 차단보다 먼저 판정된다 — 더 좁은 사유를 말한다', () => {
  const failures: FailureSample[] = [
    ...fails(IP_FAIL_LIMIT, IP),
    ...Array.from({ length: VAULT_FAIL_LIMIT }, (_, i) => ({ ipHash: `ip${i}`, at: NOW - 500 - i })),
  ];
  assert.equal(evaluateRateLimit({ now: NOW, ipHash: IP, failures }).reason, 'ip');
});

test('IP를 모르면 IP 차단은 걸지 않는다 — 모르는 것으로 모두를 막으면 안 된다', () => {
  const v = evaluateRateLimit({ now: NOW, ipHash: null, failures: fails(IP_FAIL_LIMIT, null) });
  assert.equal(v.reason, null);
  assert.equal(v.blocked, false);
});

test('차단은 마지막 실패에서부터 센다 — 계속 두드리면 계속 막힌다', () => {
  const recent = [{ ipHash: IP, at: NOW }, ...fails(IP_FAIL_LIMIT - 1, IP)];
  const v = evaluateRateLimit({ now: NOW, ipHash: IP, failures: recent });
  assert.equal(v.retryAfterMs, IP_BLOCK_MS);
});
