/**
 * 포스터 추출 필드 정규화 회귀 시험
 *
 *   node --test lib/ai/eventFields.test.ts
 *
 * 여기 있는 사례는 전부 **실제 포스터에 나오는 표기**다. 특히 오전/오후는 눈으로
 * 읽어서는 맞는지 알 수 없어(저녁 7시 공연이 07:00으로 저장돼도 형식은 멀쩡하다)
 * 시험으로 고정하지 않으면 조용히 되돌아간다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  looksLikeAddress,
  parseTime,
  reconcileEventTimes,
  splitVenueAndAddress,
  type ParsedTime,
} from './eventFields.ts';

/* ── 시간 파싱 ─────────────────────────────────────────────────────────── */

test('24시간 표기는 그대로, 확정으로 본다', () => {
  assert.deepEqual(parseTime('19:30'), { time: '19:30', explicit: true });
  assert.deepEqual(parseTime('14시'), { time: '14:00', explicit: true });
  assert.deepEqual(parseTime('00:15'), { time: '00:15', explicit: true });
});

test('영어 오전/오후 표기 — 마침표·공백·대소문자를 가리지 않는다', () => {
  // 예전 정규식은 /pm/i라 "p.m."을 놓치고 07:30을 돌려줬다(12시간 오류).
  for (const input of ['7:30 PM', '7:30 pm', '7:30 p.m.', '7:30 P.M.', '7:30p.m.']) {
    assert.deepEqual(parseTime(input), { time: '19:30', explicit: true }, input);
  }
  for (const input of ['9:00 AM', '9:00 a.m.', '9:00A.M.']) {
    assert.deepEqual(parseTime(input), { time: '09:00', explicit: true }, input);
  }
});

test('콜론 없는 표기도 받는다', () => {
  // 예전 정규식은 [:시]를 요구해 "7 PM"을 통째로 버렸다 → 시간이 사라졌다.
  assert.deepEqual(parseTime('7 PM'), { time: '19:00', explicit: true });
  assert.deepEqual(parseTime('오후 7'), { time: '19:00', explicit: true });
});

test('한국어 표기', () => {
  assert.deepEqual(parseTime('오후 7시'), { time: '19:00', explicit: true });
  assert.deepEqual(parseTime('오후 7시 30분'), { time: '19:30', explicit: true });
  assert.deepEqual(parseTime('저녁 7시'), { time: '19:00', explicit: true });
  assert.deepEqual(parseTime('오전 9시 30분'), { time: '09:30', explicit: true });
  assert.deepEqual(parseTime('새벽 5시'), { time: '05:00', explicit: true });
});

test('12시 경계 — 자정과 정오', () => {
  assert.deepEqual(parseTime('밤 12시'), { time: '00:00', explicit: true });
  assert.deepEqual(parseTime('오전 12시'), { time: '00:00', explicit: true });
  assert.deepEqual(parseTime('낮 12시'), { time: '12:00', explicit: true });
  assert.deepEqual(parseTime('오후 12시'), { time: '12:00', explicit: true });
  assert.deepEqual(parseTime('12:00 AM'), { time: '00:00', explicit: true });
  assert.deepEqual(parseTime('12:00 PM'), { time: '12:00', explicit: true });
  assert.deepEqual(parseTime('자정'), { time: '00:00', explicit: true });
  assert.deepEqual(parseTime('정오'), { time: '12:00', explicit: true });
});

test('표지 없는 1~12시는 뒤집힐 수 있다고 표시한다', () => {
  // 이 표시가 reconcileEventTimes에게 "여기는 손대도 된다"를 알려 준다.
  assert.deepEqual(parseTime('7:30'), { time: '07:30', explicit: false });
  assert.deepEqual(parseTime('12:30'), { time: '12:30', explicit: false });
  // 13시 이상은 24시간 표기로만 나올 수 있으므로 확정이다.
  assert.deepEqual(parseTime('19:30'), { time: '19:30', explicit: true });
});

test('해석할 수 없는 값은 버린다', () => {
  assert.equal(parseTime(null), null);
  assert.equal(parseTime(''), null);
  assert.equal(parseTime('미정'), null);
  assert.equal(parseTime('25:00'), null);
  assert.equal(parseTime('7:75'), null);
  // 오전·오후가 함께 걸리는 구간 문자열은 한쪽을 고르면 조용히 틀린다 → 거부.
  assert.equal(parseTime('오전 10시 ~ 오후 6시'), null);
});

test('영어 단어 속 am/pm에 걸리지 않는다', () => {
  // 장소명이 시간 칸에 섞여 들어오는 일이 실제로 있다. "program"의 am,
  // "chamber"의 am이 오전으로 읽히면 12시간이 틀어진다.
  assert.deepEqual(parseTime('program 3'), { time: '03:00', explicit: false });
  assert.deepEqual(parseTime('chamber hall 3:00'), { time: '03:00', explicit: false });
  // 진짜 표지는 여전히 잡아야 한다.
  assert.deepEqual(parseTime('program 3 PM'), { time: '15:00', explicit: true });
});

/* ── 시간 3종 교차 검증 ────────────────────────────────────────────────── */

const T = (time: string, explicit: boolean): ParsedTime => ({ time, explicit });

test('순서가 맞으면 그대로 둔다', () => {
  const r = reconcileEventTimes({
    call_time: T('18:00', true),
    start_time: T('19:30', true),
    end_time: T('21:00', true),
  });
  assert.deepEqual(r.adjusted, []);
  assert.equal(r.inconsistent, false);
  assert.equal(r.start_time, '19:30');
});

test('표지 없는 시작 시각을 순서로 되짚는다', () => {
  // 이것이 사용자가 겪은 바로 그 상황이다 —
  // 집합은 오후로 잡혔는데 시작만 오전으로 떨어졌다.
  const r = reconcileEventTimes({
    call_time: T('18:00', true),
    start_time: T('07:30', false),
    end_time: T('21:00', true),
  });
  assert.equal(r.start_time, '19:30');
  assert.deepEqual(r.adjusted, ['start_time']);
  assert.equal(r.inconsistent, false);
});

test('셋 다 표지가 없으면 공연다운 시간대를 고른다', () => {
  const r = reconcileEventTimes({
    call_time: T('06:00', false),
    start_time: T('07:00', false),
    end_time: T('09:00', false),
  });
  // 순서만 보면 집합 06:00 / 시작 19:00 도 성립한다(집합이 13시간 전이다).
  // 행사 길이가 짧은 조합을 고르는 규칙이 그것을 막는다.
  assert.deepEqual([r.call_time, r.start_time, r.end_time], ['18:00', '19:00', '21:00']);
  assert.equal(r.adjusted.length, 3);
});

test('집합만 새벽에 남는 조합을 고르지 않는다', () => {
  // 시작·종료는 자료에 오후로 적혀 있고 집합만 표지가 없는 경우.
  const r = reconcileEventTimes({
    call_time: T('06:00', false),
    start_time: T('19:00', true),
    end_time: T('21:00', true),
  });
  assert.equal(r.call_time, '18:00');
  assert.deepEqual(r.adjusted, ['call_time']);
});

test('자료에 적힌(explicit) 값은 절대 뒤집지 않는다', () => {
  // 오전 행사(워크숍 등)가 실제로 있다. 자료가 그렇게 말하면 그대로 둔다.
  const r = reconcileEventTimes({
    call_time: T('09:00', true),
    start_time: T('10:00', true),
    end_time: T('12:00', true),
  });
  assert.deepEqual([r.call_time, r.start_time, r.end_time], ['09:00', '10:00', '12:00']);
  assert.deepEqual(r.adjusted, []);
});

test('순서를 만족시킬 수 없으면 고치지 않고 알린다', () => {
  const r = reconcileEventTimes({
    call_time: T('20:00', true),
    start_time: T('19:00', true),
    end_time: T('18:00', true),
  });
  assert.equal(r.inconsistent, true);
  assert.deepEqual(r.adjusted, []);
  assert.equal(r.start_time, '19:00', '원본을 그대로 넘긴다');
});

test('일부만 있어도 동작한다', () => {
  const only = reconcileEventTimes({
    call_time: null,
    start_time: T('07:30', false),
    end_time: null,
  });
  assert.equal(only.start_time, '19:30', '단독이어도 공연다운 시간대를 고른다');

  const none = reconcileEventTimes({ call_time: null, start_time: null, end_time: null });
  assert.deepEqual([none.call_time, none.start_time, none.end_time], [null, null, null]);
  assert.equal(none.inconsistent, false);
});

/* ── 장소 ──────────────────────────────────────────────────────────────── */

test('주소로 보이는 문자열을 가려낸다', () => {
  assert.ok(looksLikeAddress('30 N Van Brunt St, Englewood, NJ 07631'));
  assert.ok(looksLikeAddress('서울특별시 종로구 세종대로 175'));
  assert.ok(looksLikeAddress('NJ 07631'));
  assert.equal(looksLikeAddress('Bergen Performing Arts Center'), false);
  assert.equal(looksLikeAddress('세종문화회관 대극장'), false);
});

test('장소명과 주소가 붙어 오면 가른다', () => {
  const r = splitVenueAndAddress('Bergen PAC, 30 N Van Brunt St, Englewood, NJ 07631', null);
  assert.equal(r.location, 'Bergen PAC');
  assert.equal(r.location_address, '30 N Van Brunt St, Englewood, NJ 07631');
  assert.equal(r.split, true);
});

test('이미 나뉘어 있으면 손대지 않는다', () => {
  const r = splitVenueAndAddress('Bergen PAC', '30 N Van Brunt St, Englewood, NJ 07631');
  assert.equal(r.location, 'Bergen PAC');
  assert.equal(r.split, false);
});

test('장소명뿐이면 그대로 둔다', () => {
  const r = splitVenueAndAddress('세종문화회관 대극장', null);
  assert.equal(r.location, '세종문화회관 대극장');
  assert.equal(r.location_address, null);
  assert.equal(r.split, false);
});
