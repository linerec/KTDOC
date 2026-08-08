/**
 * lib/d1/eventViews.test.ts — '어느 화면이 무엇을 보는가'를 잠근다
 *
 * 이 시험이 지키는 것은 SQL이 아니라 **의도**다. 조건이 조용히 빠지거나 붙는 것이
 * 이 도메인의 실제 사고였다 — 상세 페이지의 이전/다음에 kind 조건이 없어서 공연에서
 * 학내 행사로 넘어갔고, 그 행사는 정작 공연 목록에는 없었다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adminAllEvents,
  allKindsChronological,
  memberLibrary,
  publicArchive,
  publicPerformances,
} from './eventViews.ts';

test('공개 공연 목록은 학내 행사를 섞지 않는다', () => {
  const f = publicPerformances();
  assert.equal(f.kind, 'performance');
  assert.equal(f.published, true);
});

test('공개 공연 목록은 예정 공연도 포함한다 — 날짜로 자르지 않는다', () => {
  // "이런 공연을 합니다"를 보여주는 자리다. 지난 것만 보는 자리는 홈의 '최근의 기록'.
  const f = publicPerformances() as Record<string, unknown>;
  assert.ok(!('before' in f) && !('after' in f) && !('pastOnly' in f));
});

test('쇼케이스를 요청할 때만 큐레이션 조건이 붙는다', () => {
  assert.equal(publicPerformances({ showcase: true }).showcase, true);
  assert.equal(publicPerformances().showcase, undefined);
});

test('공개 아카이브는 방문자가 고른 종류만 반영하고, 이상한 값은 무시한다', () => {
  assert.equal(publicArchive({ kind: 'performance' }).kind, 'performance');
  assert.equal(publicArchive({ kind: 'school' }).kind, 'school');
  // 잘못된 쿼리스트링 때문에 빈 화면이 나오면 안 된다 — 거르지 않고 전체를 보여준다
  assert.equal(publicArchive({ kind: 'zzz' }).kind, undefined);
  assert.equal(publicArchive({}).kind, undefined);
  assert.equal(publicArchive({}).published, true);
});

test('연혁·일정은 종류를 섞는 것이 의도다 — kind 조건이 붙으면 안 된다', () => {
  const f = allKindsChronological();
  assert.equal(f.kind, undefined, '연혁에 kind를 걸면 흐름이 끊긴다');
  assert.equal(f.published, true);
});

test('회원 화면도 종류를 섞는다 — 자기가 참여한 공연과 학내 행사를 함께 본다', () => {
  assert.equal(memberLibrary({ canSeeUnpublished: true }).kind, undefined);
  assert.equal(memberLibrary({ canSeeUnpublished: false }).kind, undefined);
});

test('비공개 이벤트는 회원에게만 — 이 판단은 한 곳에만 있어야 한다', () => {
  assert.equal(memberLibrary({ canSeeUnpublished: true }).published, 'all');
  assert.equal(memberLibrary({ canSeeUnpublished: false }).published, true);
});

test('운영 화면은 게시·미게시를 모두 본다', () => {
  assert.equal(adminAllEvents().published, 'all');
  assert.equal(adminAllEvents().kind, undefined);
});

test('공개 화면은 절대 미게시를 보여주지 않는다', () => {
  for (const f of [
    publicPerformances(),
    publicPerformances({ showcase: true }),
    publicArchive({}),
    publicArchive({ kind: 'school' }),
    allKindsChronological(),
    memberLibrary({ canSeeUnpublished: false }),
  ]) {
    assert.equal(f.published, true);
  }
});

test('사용자 입력(연도·카테고리·검색·페이지)은 그대로 전달된다', () => {
  const params = { year: 2026, category: 'festival', search: '광복절', page: 3 };
  for (const f of [publicArchive(params), memberLibrary({ ...params, canSeeUnpublished: false }), adminAllEvents(params)]) {
    assert.equal(f.year, 2026);
    assert.equal(f.category, 'festival');
    assert.equal(f.search, '광복절');
    assert.equal(f.page, 3);
  }
});
