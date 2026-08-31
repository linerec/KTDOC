import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGate, type GateVaultFacts } from './gate.ts';

const NOW = Date.parse('2026-09-01T12:00:00Z');

function vault(over: Partial<GateVaultFacts> = {}): GateVaultFacts {
  return {
    id: 5,
    active: true,
    expiresAt: null,
    allowDownload: true,
    allowEmail: true,
    linkEpoch: 2,
    ...over,
  };
}

test('없는 자료함은 not_found — 무엇을 물어도', () => {
  for (const need of ['view', 'download', 'email'] as const) {
    const v = evaluateGate({ vault: null, now: NOW, cookie: { vaultId: 5 }, link: null, need });
    assert.deepEqual(v, { ok: false, reason: 'not_found' });
  }
});

test('쿠키가 있으면 열린다', () => {
  const v = evaluateGate({
    vault: vault(),
    now: NOW,
    cookie: { vaultId: 5 },
    link: null,
    need: 'view',
  });
  assert.deepEqual(v, { ok: true, vaultId: 5, via: 'cookie' });
});

test('아무 열쇠도 없으면 잠겨 있다', () => {
  const v = evaluateGate({ vault: vault(), now: NOW, cookie: null, link: null, need: 'view' });
  assert.deepEqual(v, { ok: false, reason: 'locked' });
});

test('다른 자료함의 쿠키는 이 자료함을 열지 못한다', () => {
  const v = evaluateGate({
    vault: vault(),
    now: NOW,
    cookie: { vaultId: 9 },
    link: null,
    need: 'view',
  });
  assert.deepEqual(v, { ok: false, reason: 'locked' });
});

test('꺼 둔 자료함은 열쇠가 있어도 안 열린다 — 끄는 것이 즉시 듣지 않으면 끄는 의미가 없다', () => {
  const v = evaluateGate({
    vault: vault({ active: false }),
    now: NOW,
    cookie: { vaultId: 5 },
    link: null,
    need: 'view',
  });
  assert.deepEqual(v, { ok: false, reason: 'inactive' });
});

test('만료일이 지나면 열리지 않는다', () => {
  const v = evaluateGate({
    vault: vault({ expiresAt: '2026-08-31T23:59:59Z' }),
    now: NOW,
    cookie: { vaultId: 5 },
    link: null,
    need: 'view',
  });
  assert.deepEqual(v, { ok: false, reason: 'expired' });
});

test('만료일이 아직이면 열린다', () => {
  const v = evaluateGate({
    vault: vault({ expiresAt: '2026-09-30T00:00:00Z' }),
    now: NOW,
    cookie: { vaultId: 5 },
    link: null,
    need: 'view',
  });
  assert.equal(v.ok, true);
});

test('읽을 수 없는 만료일은 만료로 보지 않는다 — 잘못된 값 때문에 현장에서 막히면 안 된다', () => {
  const v = evaluateGate({
    vault: vault({ expiresAt: '언젠가' }),
    now: NOW,
    cookie: { vaultId: 5 },
    link: null,
    need: 'view',
  });
  assert.equal(v.ok, true);
});

test('세대가 맞는 받기 링크는 비밀번호 없이 연다', () => {
  const v = evaluateGate({
    vault: vault({ linkEpoch: 2 }),
    now: NOW,
    cookie: null,
    link: { vaultId: 5, epoch: 2 },
    need: 'view',
  });
  assert.deepEqual(v, { ok: true, vaultId: 5, via: 'link' });
});

test('무효화된(옛 세대) 링크는 죽는다', () => {
  const v = evaluateGate({
    vault: vault({ linkEpoch: 3 }),
    now: NOW,
    cookie: null,
    link: { vaultId: 5, epoch: 2 },
    need: 'view',
  });
  assert.deepEqual(v, { ok: false, reason: 'locked' });
});

test('다른 자료함을 가리키는 링크는 듣지 않는다', () => {
  const v = evaluateGate({
    vault: vault(),
    now: NOW,
    cookie: null,
    link: { vaultId: 9, epoch: 2 },
    need: 'view',
  });
  assert.deepEqual(v, { ok: false, reason: 'locked' });
});

test('다운로드를 막아 둔 자료함은 보기는 되고 받기는 안 된다', () => {
  const facts = {
    vault: vault({ allowDownload: false }),
    now: NOW,
    cookie: { vaultId: 5 },
    link: null,
  };
  assert.equal(evaluateGate({ ...facts, need: 'view' }).ok, true);
  assert.deepEqual(evaluateGate({ ...facts, need: 'download' }), {
    ok: false,
    reason: 'download_denied',
  });
});

test('메일을 막아 둔 자료함은 보내기만 안 된다', () => {
  const facts = {
    vault: vault({ allowEmail: false }),
    now: NOW,
    cookie: { vaultId: 5 },
    link: null,
  };
  assert.equal(evaluateGate({ ...facts, need: 'view' }).ok, true);
  assert.deepEqual(evaluateGate({ ...facts, need: 'email' }), {
    ok: false,
    reason: 'email_denied',
  });
});

test('잠긴 상태에서는 다운로드 금지보다 잠김이 먼저다 — 열쇠 없는 사람에게 설정을 알리지 않는다', () => {
  const v = evaluateGate({
    vault: vault({ allowDownload: false }),
    now: NOW,
    cookie: null,
    link: null,
    need: 'download',
  });
  assert.deepEqual(v, { ok: false, reason: 'locked' });
});

test('쿠키와 링크가 둘 다 있으면 쿠키가 이긴다', () => {
  const v = evaluateGate({
    vault: vault(),
    now: NOW,
    cookie: { vaultId: 5 },
    link: { vaultId: 5, epoch: 2 },
    need: 'view',
  });
  assert.equal(v.ok && v.via, 'cookie');
});
