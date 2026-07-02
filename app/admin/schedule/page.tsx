/**
 * 캘린더 (멤버용) — 이벤트 + 내 수업 통합
 *
 * 공연·행사(이벤트)와 내가 배정된 수업(정규 수업은 요일 반복, 캠프는 기간)을 한 달력에서 본다.
 * 이벤트 칸을 누르면 이벤트 상세, 수업 칸을 누르면 '내 수업' 상세로 이동.
 * 학생은 비공개 이벤트도 포함해 보고 체크인할 수 있어 전체를, 그 외 역할은 공개분만 본다.
 * 수업: 학생=본인 배정, 학부모=연결된 자녀의 배정.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import {
  getEvents,
  getUserCheckedInEventIds,
  getEnrollmentsForUser,
  getEnrollmentsForUsers,
} from '@/lib/d1';
import { getGuardianChildren } from '@/lib/members';
import { expandClassesForMonth, type ClassOccurrence } from '@/lib/programSchedule';
import type { EventWithCategory } from '@/types/gallery';
import type { MemberRole } from '@/types/members';
import type { MyEnrollment } from '@/types/programs';

export const metadata: Metadata = {
  title: '캘린더 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{ month?: string }>;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

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

  // 날짜별 이벤트(이번 달만)
  const eventsByDate = new Map<string, EventWithCategory[]>();
  for (const e of eventsResult.events) {
    if (e.event_date.startsWith(monthStr)) {
      const list = eventsByDate.get(e.event_date) ?? [];
      list.push(e);
      eventsByDate.set(e.event_date, list);
    }
  }

  // 날짜별 수업(요일 반복·캠프 기간 전개)
  const classesByDate = expandClassesForMonth(enrollments, year, month);

  // 달력 격자(일요일 시작). UTC 기준 날짜 연산으로 타임존 영향 제거.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const todayStr = new Date().toISOString().slice(0, 10);

  const monthEventCount = Array.from(eventsByDate.values()).reduce((a, l) => a + l.length, 0);
  const monthClassCount = Array.from(classesByDate.values()).reduce((a, l) => a + l.length, 0);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <h1 className="admin-title">캘린더</h1>
          <p className="admin-subtitle">
            공연·행사와 내 수업 일정을 월별로 확인합니다. 칸을 누르면 상세가 열립니다.
            {canCheckIn && ' 내가 참여하는 이벤트는 ✓로 표시됩니다.'}
          </p>
        </div>
      </div>

      <div className="cal-toolbar">
        <Link href={`/admin/schedule?month=${ymd(prev.y, prev.m)}`} className="admin-btn admin-btn-sm admin-btn-outline">
          ← 이전
        </Link>
        <span className="cal-title">{year}년 {month}월</span>
        <Link href={`/admin/schedule?month=${ymd(next.y, next.m)}`} className="admin-btn admin-btn-sm admin-btn-outline">
          다음 →
        </Link>
        <Link href="/admin/schedule" className="admin-btn admin-btn-sm">오늘</Link>
        <span className="cal-count">이번 달 이벤트 {monthEventCount} · 수업 {monthClassCount}</span>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`cal-weekday${i === 0 ? ' cal-sun' : ''}${i === 6 ? ' cal-sat' : ''}`}>
            {w}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`e${idx}`} className="cal-cell cal-cell-empty" />;
          }
          const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
          const dayEvents = eventsByDate.get(dateStr) ?? [];
          const dayClasses: ClassOccurrence[] = classesByDate.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;
          const dow = idx % 7;
          return (
            <div key={dateStr} className={`cal-cell${isToday ? ' cal-today' : ''}`}>
              <span className={`cal-daynum${dow === 0 ? ' cal-sun' : ''}${dow === 6 ? ' cal-sat' : ''}`}>
                {day}
              </span>
              <div className="cal-events">
                {dayEvents.map((e) => {
                  const isMine = canCheckIn && checkedInIds.has(e.id);
                  const isDraft = e.is_published === 0;
                  return (
                    <Link
                      key={`ev-${e.id}`}
                      href={`/admin/library/${e.id}`}
                      className={`cal-event${isMine ? ' is-mine' : ''}${isDraft ? ' is-draft' : ''}`}
                      title={e.title_ko}
                    >
                      {isMine && '✓ '}
                      {e.title_ko}
                    </Link>
                  );
                })}
                {dayClasses.map((c, i) => (
                  <Link
                    key={`cl-${c.programId}-${i}`}
                    href={`/admin/my-classes/${c.programId}`}
                    className="cal-class"
                    title={c.time ? `${c.title_ko} (${c.time})` : c.title_ko}
                  >
                    {c.time ? `${c.time} ` : ''}
                    {c.title_ko}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="cal-legend">
        {canCheckIn && <span><i className="cal-swatch is-mine" /> 내가 참여</span>}
        <span><i className="cal-swatch" /> 이벤트</span>
        {memberView && <span><i className="cal-swatch is-class" /> 내 수업</span>}
        {memberView && <span><i className="cal-swatch is-draft" /> 비공개</span>}
      </div>
    </div>
  );
}
