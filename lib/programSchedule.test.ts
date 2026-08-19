/**
 * programSchedule — 수업 전개의 소유자(owners) 병합 규칙
 *
 * 학부모 캘린더는 자녀 여러 명의 배정을 한꺼번에 전개한다. 형제가 같은 수업에
 * 다니면 같은 날짜에 같은 수업이 두 줄로 뜨는 대신, **한 항목에 소유자 두 명**이
 * 담겨야 한다 — 캘린더가 "누구의 수업인지"를 붙일 수 있는 근거다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandClassesForMonth } from './programSchedule.ts';
import type { MyEnrollment } from '../types/programs.ts';

/** 테스트용 최소 배정 — 전개에 쓰이는 필드만 채운다. */
function enrollment(
  userId: string,
  program: Record<string, unknown>,
  status = 'active'
): MyEnrollment {
  return {
    enrollment_id: Math.floor(Math.random() * 1e6),
    user_id: userId,
    status,
    note: null,
    enrolled_at: '2026-01-01 00:00:00',
    program: {
      id: 1,
      slug: 'test-class',
      title_ko: '테스트 수업',
      title_en: null,
      program_type: 'class',
      weekdays: '3', // 수요일
      term_start_date: null,
      term_end_date: null,
      class_start_time: '16:00',
      class_end_time: '17:00',
      start_date: null,
      end_date: null,
      ...program,
    },
  } as unknown as MyEnrollment;
}

test('형제가 같은 수업이면 같은 날짜에 한 항목으로 접히고 owners에 둘 다 담긴다', () => {
  const byDate = expandClassesForMonth(
    [enrollment('child-a', {}), enrollment('child-b', {})],
    2026,
    7
  );
  // 2026-07-01은 수요일
  const list = byDate.get('2026-07-01');
  assert.ok(list, '수요일 날짜에 전개돼야 한다');
  assert.equal(list!.length, 1, '같은 수업은 한 항목이어야 한다');
  assert.deepEqual([...list![0].owners].sort(), ['child-a', 'child-b']);
});

test('혼자 배정된 수업은 owners가 본인 하나다', () => {
  const byDate = expandClassesForMonth([enrollment('child-a', {})], 2026, 7);
  assert.deepEqual(byDate.get('2026-07-01')![0].owners, ['child-a']);
});

test('다른 수업은 같은 날짜라도 병합하지 않는다', () => {
  const byDate = expandClassesForMonth(
    [
      enrollment('child-a', { id: 1 }),
      enrollment('child-b', { id: 2, title_ko: '다른 수업' }),
    ],
    2026,
    7
  );
  assert.equal(byDate.get('2026-07-01')!.length, 2);
});

test('캠프도 같은 프로그램이면 병합된다', () => {
  const camp = {
    id: 9,
    program_type: 'camp',
    weekdays: null,
    start_date: '2026-07-06',
    end_date: '2026-07-08',
  };
  const byDate = expandClassesForMonth(
    [enrollment('child-a', camp), enrollment('child-b', camp)],
    2026,
    7
  );
  const list = byDate.get('2026-07-07');
  assert.equal(list!.length, 1);
  assert.deepEqual([...list![0].owners].sort(), ['child-a', 'child-b']);
});

test('취소된 배정은 owners에도 들어가지 않는다', () => {
  const byDate = expandClassesForMonth(
    [enrollment('child-a', {}), enrollment('child-b', {}, 'cancelled')],
    2026,
    7
  );
  assert.deepEqual(byDate.get('2026-07-01')![0].owners, ['child-a']);
});
