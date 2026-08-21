/**
 * 배경 스크롤 잠금 시험
 *
 *   node --test lib/bodyScrollLock.test.ts
 *
 * 여기서 잠그는 것은 **되돌아온다는 보장**이다. 잠금을 켜는 쪽과 끄는 쪽이 따로
 * 있으면 끄지 않고 떠나는 경로(뒤로가기)가 생기고, 그 순간 body는 잠긴 채 남는다.
 * 잠금 함수가 되돌리기 함수를 돌려주도록 강제해 그 경로를 없앤다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lockBodyScroll } from './bodyScrollLock.ts';

/** document.body 대역 — 우리가 만지는 건 style.overflow 하나뿐이다 */
function fakeBody(overflow = '') {
  return { style: { overflow } };
}

test('잠그면 hidden, 되돌리면 원래 값', () => {
  const body = fakeBody();
  const release = lockBodyScroll(body);
  assert.equal(body.style.overflow, 'hidden');
  release();
  assert.equal(body.style.overflow, '');
});

test('원래 값이 있으면 그 값으로 되돌린다 — 빈 문자열로 뭉개지 않는다', () => {
  const body = fakeBody('clip');
  const release = lockBodyScroll(body);
  assert.equal(body.style.overflow, 'hidden');
  release();
  assert.equal(body.style.overflow, 'clip');
});

test('중첩 잠금 — 안쪽을 풀어도 바깥 잠금은 유지된다', () => {
  const body = fakeBody();
  const releaseOuter = lockBodyScroll(body); // 라이트박스
  const releaseInner = lockBodyScroll(body); // 그 위에 뜬 모달

  releaseInner();
  assert.equal(body.style.overflow, 'hidden', '바깥이 아직 잠겨 있어야 한다');

  releaseOuter();
  assert.equal(body.style.overflow, '');
});

test('되돌리기를 두 번 불러도 나중 잠금을 덮어쓰지 않는다', () => {
  const body = fakeBody();
  const release = lockBodyScroll(body);
  release();
  assert.equal(body.style.overflow, '');

  // 되돌린 뒤 다른 곳에서 새로 잠갔는데, 앞의 정리 함수가 한 번 더 불리는 경우
  lockBodyScroll(body);
  release();
  assert.equal(body.style.overflow, 'hidden', '남의 잠금을 풀어서는 안 된다');
});
