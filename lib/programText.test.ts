/**
 * programText — 카드·상세의 일정 문구가 캘린더와 같은 말을 하는가
 *
 * 캘린더는 '둘째·넷째 주'로 고쳐졌는데 카드가 "매주 토"로 남는 것이 이 시스템에서
 * 실제로 벌어진 일이다. 문구와 전개가 같은 데이터를 읽는지 여기서 잠근다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClassSchedule } from './programText.ts';

const base = { program_type: 'class', class_start_time: '17:15', class_end_time: '18:45' };

test('주차가 없으면 종전대로 매주다', () => {
  const p = { ...base, weekdays: '6' };
  assert.equal(formatClassSchedule(p, 'ko'), '매주 토 17:15~18:45');
  assert.equal(formatClassSchedule(p, 'en'), 'Every Sat 17:15~18:45');
});

test('주차가 있으면 매주라고 말하지 않는다', () => {
  const p = { ...base, weekdays: '6', week_ordinals: '2,4' };
  assert.equal(formatClassSchedule(p, 'ko'), '매월 둘째·넷째 주 토요일 17:15~18:45');
  assert.equal(formatClassSchedule(p, 'en'), '2nd & 4th Sat 17:15~18:45');
  assert.ok(!formatClassSchedule(p, 'ko').includes('매주'));
});

test('성인반(일요일 둘째·넷째)', () => {
  const p = {
    program_type: 'class',
    weekdays: '0',
    week_ordinals: '2,4',
    class_start_time: '15:45',
    class_end_time: '16:30',
  };
  assert.equal(formatClassSchedule(p, 'ko'), '매월 둘째·넷째 주 일요일 15:45~16:30');
});

test('주차는 순서대로 읽힌다 — 저장 순서가 뒤집혀도', () => {
  const p = { ...base, weekdays: '6', week_ordinals: '4,2' };
  assert.equal(formatClassSchedule(p, 'ko'), '매월 둘째·넷째 주 토요일 17:15~18:45');
});

test('요일이 없으면 운영진이 적은 자유 텍스트로 물러선다', () => {
  const p = {
    program_type: 'class',
    weekdays: null,
    week_ordinals: '2,4',
    schedule_ko: '문의 요망',
  };
  assert.equal(formatClassSchedule(p, 'ko'), '문의 요망');
});

test('캠프는 기간 그대로다', () => {
  const p = { program_type: 'camp', start_date: '2026-08-01', end_date: '2026-08-15' };
  assert.equal(formatClassSchedule(p, 'ko'), '2026-08-01 ~ 2026-08-15');
});
