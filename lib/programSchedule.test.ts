/**
 * programSchedule — 수업 전개의 소유자(owners) 병합 규칙
 *
 * 학부모 캘린더는 자녀 여러 명의 배정을 한꺼번에 전개한다. 형제가 같은 수업에
 * 다니면 같은 날짜에 같은 수업이 두 줄로 뜨는 대신, **한 항목에 소유자 두 명**이
 * 담겨야 한다 — 캘린더가 "누구의 수업인지"를 붙일 수 있는 근거다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandClassesForMonth,
  classMeetsOn,
  classDatesInMonth,
  weekOrdinalOfMonth,
} from './programSchedule.ts';
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

// ============================================================
// 주차(week_ordinals) — "매월 둘째·넷째 주"
//   성인반·청소년 고급반이 격주인데 캘린더가 매주로 보여 주던 자리다.
//   2026년 9월 토요일: 5(1주) 12(2주) 19(3주) 26(4주)
//   2026년 9월 일요일: 6(1주) 13(2주) 20(3주) 27(4주)
// ============================================================

test('주차 계산은 그 달 며칠인가로 정한다 (1~7일=1주, 8~14일=2주 …)', () => {
  assert.equal(weekOrdinalOfMonth(1), 1);
  assert.equal(weekOrdinalOfMonth(7), 1);
  assert.equal(weekOrdinalOfMonth(8), 2);
  assert.equal(weekOrdinalOfMonth(14), 2);
  assert.equal(weekOrdinalOfMonth(15), 3);
  assert.equal(weekOrdinalOfMonth(29), 5);
});

test('week_ordinals가 비면 종전처럼 매주다', () => {
  const dates = classDatesInMonth({ weekdays: '6' }, 2026, 9);
  assert.deepEqual(dates, ['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26']);
});

test('week_ordinals "2,4"면 둘째·넷째 주에만 열린다', () => {
  const dates = classDatesInMonth({ weekdays: '6', week_ordinals: '2,4' }, 2026, 9);
  assert.deepEqual(dates, ['2026-09-12', '2026-09-26']);
});

test('성인반(일요일 둘째·넷째)도 학기 시작일과 어긋나지 않는다', () => {
  const dates = classDatesInMonth(
    { weekdays: '0', week_ordinals: '2,4', term_start_date: '2026-09-13' },
    2026,
    9
  );
  assert.deepEqual(dates, ['2026-09-13', '2026-09-27']);
});

test('일요일이 다섯 번인 달에도 넷째 주는 넷째 주다 (14일 간격이 아니다)', () => {
  // 2026-11 일요일: 1, 8, 15, 22, 29
  const dates = classDatesInMonth({ weekdays: '0', week_ordinals: '2,4' }, 2026, 11);
  assert.deepEqual(dates, ['2026-11-08', '2026-11-22']);
});

test('캘린더 전개도 주차를 지킨다 — 없는 수업이 뜨지 않는다', () => {
  const byDate = expandClassesForMonth(
    [enrollment('child-a', { weekdays: '6', week_ordinals: '2,4' })],
    2026,
    9
  );
  assert.ok(byDate.get('2026-09-12'), '둘째 토요일에는 있어야 한다');
  assert.equal(byDate.get('2026-09-19'), undefined, '셋째 토요일에는 없어야 한다');
  assert.ok(byDate.get('2026-09-26'), '넷째 토요일에는 있어야 한다');
});

// ============================================================
// 날짜 예외(skip_dates / extra_dates) — "이번 달만 3·4주로"
// ============================================================

test('skip_dates에 적힌 날은 규칙에 맞아도 쉰다', () => {
  const dates = classDatesInMonth(
    { weekdays: '6', week_ordinals: '2,4', skip_dates: '2026-09-12' },
    2026,
    9
  );
  assert.deepEqual(dates, ['2026-09-26']);
});

test('extra_dates에 적힌 날은 규칙에 없어도 한다', () => {
  const dates = classDatesInMonth(
    { weekdays: '6', week_ordinals: '2,4', extra_dates: '2026-09-19' },
    2026,
    9
  );
  assert.deepEqual(dates, ['2026-09-12', '2026-09-19', '2026-09-26']);
});

test('원장님 사례: 둘째를 빼고 셋째를 넣으면 그 달만 3·4주가 된다', () => {
  const dates = classDatesInMonth(
    {
      weekdays: '0',
      week_ordinals: '2,4',
      skip_dates: '2026-09-13',
      extra_dates: '2026-09-20',
    },
    2026,
    9
  );
  assert.deepEqual(dates, ['2026-09-20', '2026-09-27']);
});

test('같은 날이 양쪽에 있으면 쉰다 — 취소가 더 강한 의사표시다', () => {
  assert.equal(
    classMeetsOn(
      { weekdays: '6', skip_dates: '2026-09-12', extra_dates: '2026-09-12' },
      '2026-09-12'
    ),
    false
  );
});

test('extra_dates는 학기 기간 밖이어도 살아 있다 — 사람이 직접 적은 날짜다', () => {
  assert.equal(
    classMeetsOn(
      { weekdays: '6', term_start_date: '2026-10-01', extra_dates: '2026-09-19' },
      '2026-09-19'
    ),
    true
  );
});

test('요일이 없어도 extra_dates만으로 전개된다', () => {
  const byDate = expandClassesForMonth(
    [enrollment('child-a', { weekdays: null, extra_dates: '2026-09-19' })],
    2026,
    9
  );
  assert.ok(byDate.get('2026-09-19'));
});
