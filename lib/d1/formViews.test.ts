/**
 * lib/d1/formViews.test.ts — '어느 화면이 어떤 응답을 보는가'와 파라미터 한계를 잠근다
 *
 * eventViews.test.ts 와 같은 이유로 존재한다: 조건이 조용히 빠지거나 붙는 것이
 * 이 도메인의 실제 사고다. 여기에 더해 D1 고유의 함정 하나를 더 잠근다 —
 * 바인딩 파라미터 상한 100개(실측). 응답이 늘어야 터지는 종류라 눈으로는 못 잡는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkParams } from './chunk.ts';
import { adminResponseList, publicFormBySlug, rosterView } from './formViews.ts';

test('파라미터는 90개 단위로 쪼갠다 — D1 상한 100 아래로 여유를 둔다', () => {
  const ids = Array.from({ length: 200 }, (_, i) => i);
  const chunks = chunkParams(ids);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 90);
  assert.equal(chunks[2].length, 20);
  assert.deepEqual(chunks.flat(), ids);
});

test('빈 배열은 빈 청크 목록이 된다 — IN () 를 만들지 않는다', () => {
  assert.deepEqual(chunkParams([]), []);
});

test('청크 크기를 지정할 수 있다 — 행당 파라미터 수가 다르기 때문이다', () => {
  // 파생 INSERT 는 행당 6개를 쓰므로 15행이면 90개다
  const rows = Array.from({ length: 40 }, (_, i) => i);
  const chunks = chunkParams(rows, 15);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 15);
  assert.equal(chunks[2].length, 10);
});

test('공개 폼 조회는 게시된 것만 본다 — 초안이 URL 로 새면 안 된다', () => {
  const f = publicFormBySlug('2026-2027-regular');
  assert.equal(f.slug, '2026-2027-regular');
  assert.deepEqual(f.statuses, ['open']);
});

test('운영 응답 목록은 기본으로 최신본만, 취소는 빼고 본다', () => {
  const f = adminResponseList({ formId: 1 });
  assert.equal(f.latestOnly, true);
  assert.equal(f.formId, 1);
  assert.ok(!f.statuses?.includes('cancelled'));
});

test('운영 응답 목록은 상태를 지정하면 그것만 본다 — 취소 열람 경로가 있어야 한다', () => {
  assert.deepEqual(adminResponseList({ formId: 1, status: 'cancelled' }).statuses, ['cancelled']);
});

test('목록 개수에는 상한이 있다 — 한 번에 전부 긁어오다 D1을 때리지 않는다', () => {
  assert.equal(adminResponseList({ formId: 1, limit: 99999 }).limit, 500);
  assert.equal(adminResponseList({ formId: 1 }).limit, 100);
});

test('명단은 1년 등록 우선, 그다음 선착순 — 이 정렬이 배정 규칙 자체다', () => {
  // 삼고무·오고무는 북 수량이 제한돼 1년 등록 학생에게 우선 배정되고 잔여는 선착순이다.
  const v = rosterView({ formId: 1, periodQuestionKey: 'q6_period', fullYearOptionKey: 'y1' });
  assert.equal(v.orderBy, 'full_year_first');
  assert.equal(v.fullYearOptionKey, 'y1');
  assert.equal(v.periodQuestionKey, 'q6_period');
});
