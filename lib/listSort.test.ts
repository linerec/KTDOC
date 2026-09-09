import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LIST_SORT, parseListSort } from './listSort.ts';

test('기본 정렬은 개최일이다', () => {
  assert.equal(DEFAULT_LIST_SORT, 'date');
  assert.equal(parseListSort(undefined), 'date');
  assert.equal(parseListSort(null), 'date');
  assert.equal(parseListSort(''), 'date');
});

test('등록순은 명시할 때만', () => {
  assert.equal(parseListSort('created'), 'created');
  assert.equal(parseListSort(['created', 'date']), 'created');
});

test('모르는 값은 기본으로 떨어진다 — 이상한 주소로 화면이 깨지지 않는다', () => {
  assert.equal(parseListSort('zzz'), 'date');
  assert.equal(parseListSort('DESC'), 'date');
});
