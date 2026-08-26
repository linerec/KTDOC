import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApplyMode, acceptsLegacyApplication } from './applyRoute.ts';

test('신청서가 안 붙은 수업은 옛 경로로 받는다 — 여름 특강처럼 폼이 없는 수업', () => {
  assert.equal(resolveApplyMode(null), 'legacy');
  assert.equal(resolveApplyMode(undefined), 'legacy');
  assert.equal(acceptsLegacyApplication(null), true);
});

test('신청서가 붙어 접수 중이면 신청서로 간다', () => {
  assert.equal(resolveApplyMode({ isOpen: true }), 'form');
});

test('마감된 신청서는 옛 경로로 흘러내리지 않는다 — 이것이 이 모듈의 요점', () => {
  // 폴백시키면 원장이 접수를 마감한 순간 수업 전부가 표시 없이 옛 폼으로 돌아간다.
  assert.equal(resolveApplyMode({ isOpen: false }), 'closed');
  assert.notEqual(resolveApplyMode({ isOpen: false }), 'legacy');
});

test('옛 경로를 받아도 되는 경우는 신청서가 없을 때뿐이다', () => {
  assert.equal(acceptsLegacyApplication({ isOpen: true }), false);
  assert.equal(acceptsLegacyApplication({ isOpen: false }), false);
  assert.equal(acceptsLegacyApplication(null), true);
});

test('한 수업의 모든 버튼은 같은 답을 받는다 — 히어로와 사이드바가 갈리지 않는다', () => {
  for (const linked of [null, { isOpen: true }, { isOpen: false }]) {
    const hero = resolveApplyMode(linked);
    const sidebar = resolveApplyMode(linked);
    const server = acceptsLegacyApplication(linked);
    assert.equal(hero, sidebar);
    // 서버가 옛 신청을 받는 경우는 화면이 옛 모달을 여는 경우와 정확히 일치한다.
    assert.equal(server, hero === 'legacy');
  }
});
