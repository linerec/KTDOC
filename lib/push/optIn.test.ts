/**
 * 알림 온보딩 판단 시험
 *
 *   node --test lib/push/optIn.test.ts
 *
 * 특히 "접어도 되는가"를 조인다. 잘못 접히면 회원은 알림이 켜진 줄 알고 기다리는데
 * 아무것도 오지 않는다 — 화면에 아무 흔적도 남지 않아 신고조차 안 들어오는 종류의 사고다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveOptInState, canCollapse, type OptInEnv } from './optIn.ts';

/** 안드로이드 크롬에서 아직 안 켠 상태 — 나머지 시험은 여기서 한 가지씩만 비튼다. */
const BASE: OptInEnv = {
  supported: true,
  platform: 'android',
  standalone: false,
  permission: 'default',
  hasSubscription: false,
};

/* ── 상태 판별 ─────────────────────────────────────────────────────────── */

test('지원 + 미구독 → 권유', () => {
  assert.equal(resolveOptInState(BASE), 'prompt');
});

test('지원 + 구독됨 → 켜짐', () => {
  assert.equal(
    resolveOptInState({ ...BASE, permission: 'granted', hasSubscription: true }),
    'enabled'
  );
});

test('권한 거부는 구독 상태보다 앞선다 — 브라우저 설정에서 푼 게 아니면 손쓸 수 없다', () => {
  assert.equal(
    resolveOptInState({ ...BASE, permission: 'denied', hasSubscription: true }),
    'denied'
  );
});

test('iOS 미설치는 미지원이 아니라 설치 안내 — 한 단계만 더 가면 된다', () => {
  assert.equal(
    resolveOptInState({ ...BASE, supported: false, platform: 'ios', standalone: false }),
    'needs-install'
  );
});

test('iOS 설치했는데도 미지원이면 진짜 미지원(구형 iOS)', () => {
  assert.equal(
    resolveOptInState({ ...BASE, supported: false, platform: 'ios', standalone: true }),
    'unsupported'
  );
});

test('데스크톱 미지원 브라우저는 설치를 권하지 않는다 — 설치해도 안 된다', () => {
  assert.equal(
    resolveOptInState({ ...BASE, supported: false, platform: 'desktop' }),
    'unsupported'
  );
});

/* ── 접기 판단 ─────────────────────────────────────────────────────────── */

test('켜져 있고 서버도 이 기기를 알면 접는다', () => {
  assert.equal(canCollapse('enabled', true, true), true);
});

test('서버가 이 기기를 모르면 켜져 보여도 접지 않는다 — 조용한 미수신 방지', () => {
  assert.equal(canCollapse('enabled', true, false), false);
});

test('접기를 켜지 않은 자리(프로필 설정)에서는 켜져 있어도 남는다 — 끄기 버튼의 집', () => {
  assert.equal(canCollapse('enabled', false, true), false);
});

test('켜짐 외의 상태는 무엇이든 접지 않는다', () => {
  for (const state of ['loading', 'unsupported', 'needs-install', 'prompt', 'denied'] as const) {
    assert.equal(canCollapse(state, true, true), false, `${state}는 접히면 안 된다`);
  }
});
