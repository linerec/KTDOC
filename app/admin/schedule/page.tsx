/**
 * 캘린더 (멤버용) — 공연 + 내 수업 통합
 *
 * 공연·행사와 내가 배정된 수업(정규 수업은 요일 반복, 캠프는 기간)을 한 달력에서 본다.
 * 학생은 비공개 공연도 포함해 보고 체크인할 수 있어 전체를, 그 외 역할은 공개분만 본다.
 * 수업: 학생=본인 배정, 학부모=연결된 자녀의 배정.
 *
 * 이 페이지는 데이터만 모아 평평한 CalendarItem[]로 넘기고, 격자·일정판 렌더링과
 * 날짜 선택 상태는 ScheduleCalendar(클라이언트)가 맡는다. 상세로 가는 링크는
 * 칸이 아니라 일정판 목록에 있다(칸이 몇 개의 일정을 담든 격자가 무너지지 않게).
 */

import type { Metadata } from 'next';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import {
  getEvents,
  getUserCheckedInEventIds,
  getEnrollmentsForUser,
  getEnrollmentsForUsers,
} from '@/lib/d1';
import { getGuardianChildren } from '@/lib/members';
import { expandClassesForMonth } from '@/lib/programSchedule';
import ScheduleCalendar, { type CalendarItem } from '@/components/admin/schedule/ScheduleCalendar';
import type { MemberRole } from '@/types/members';
import type { MyEnrollment } from '@/types/programs';

export const metadata: Metadata = {
  title: '캘린더 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

function parseMonth(m: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split('-').map(Number);
    if (mo >= 1 && mo <= 12) return { year: y, month: mo };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function ymd(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** 'HH:MM(:SS)' 두 값을 캘린더 표기('19:00' / '19:00~21:00')로. 없으면 null=종일. */
function timeRange(start: string | null, end: string | null): string | null {
  const s = start ? start.slice(0, 5) : null;
  const e = end ? end.slice(0, 5) : null;
  if (s && e) return `${s}~${e}`;
  return s;
}

export default async function AdminSchedulePage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'schedule');

  const role = (session?.user?.role ?? 'user') as MemberRole;
  const userId = session?.user?.id ?? null;
  const canCheckIn = role === 'student' && !!userId;
  const memberView = (role === 'student' || role === 'parent') && !!userId;

  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonth(monthParam);
  const monthStr = ymd(year, month);

  // 내 수업(배정) 조회: 학생=본인, 학부모=자녀들. 운영진은 배정이 없어 빈 배열.
  async function loadEnrollments(): Promise<MyEnrollment[]> {
    if (!userId) return [];
    if (role === 'parent') {
      const children = await getGuardianChildren(userId);
      return children.length > 0
        ? getEnrollmentsForUsers(children.map((c) => c.studentId))
        : [];
    }
    return getEnrollmentsForUser(userId);
  }

  const [eventsResult, checkedInIds, enrollments] = await Promise.all([
    getEvents({ limit: 500, published: memberView ? 'all' : true }),
    canCheckIn ? getUserCheckedInEventIds(userId) : Promise.resolve(new Set<number>()),
    loadEnrollments(),
  ]);


  // 이번 달 공연·행사 → 캘린더 항목
  const items: CalendarItem[] = [];
  for (const e of eventsResult.events) {
    const date = e.event_date.slice(0, 10);
    if (!date.startsWith(monthStr)) continue;
    items.push({
      key: `ev-${e.id}`,
      date,
      type: e.kind === 'school' ? 'school' : 'performance',
      title: e.title_ko,
      time: timeRange(e.start_time, e.end_time),
      href: `/admin/library/${e.id}`,
      isMine: canCheckIn && checkedInIds.has(e.id),
      isDraft: e.is_published === 0,
      note: e.location || e.category_name_ko || null,
    });
  }

  // 내 수업(요일 반복·캠프 기간 전개) → 캘린더 항목
  const classesByDate = expandClassesForMonth(enrollments, year, month);
  for (const [date, list] of classesByDate) {
    list.forEach((c, i) => {
      items.push({
        key: `cl-${c.programId}-${date}-${i}`,
        date,
        type: 'class',
        title: c.title_ko,
        time: c.time,
        href: `/admin/my-classes/${c.programId}`,
        note: c.isCamp ? '캠프' : null,
      });
    });
  }

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <h1 className="admin-title">캘린더</h1>
          <p className="admin-subtitle">
            공연·행사와 내 수업 일정을 월별로 확인합니다. 날짜를 누르면 그 날 일정이 아래에 펼쳐집니다.
            {canCheckIn && ' 내가 참여하는 공연은 ✓로 표시됩니다.'}
          </p>
        </div>
      </div>

      <ScheduleCalendar
        year={year}
        month={month}
        today={todayStr}
        items={items}
        prevHref={`/admin/schedule?month=${ymd(prev.y, prev.m)}`}
        nextHref={`/admin/schedule?month=${ymd(next.y, next.m)}`}
        todayHref="/admin/schedule"
        showMine={canCheckIn}
        showMember={memberView}
      />
    </div>
  );
}
