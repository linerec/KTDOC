/**
 * 캘린더 (멤버용)
 *
 * 다가오는/지난 이벤트를 월별 달력으로 한눈에 본다. 내가 참여(체크인)하는 이벤트는 강조.
 * 칸의 이벤트를 누르면 콘솔 이벤트 상세로 이동. 접근: library.calendar 권한.
 * 학생은 비공개(미공개) 이벤트도 포함해 보고 체크인할 수 있으므로 전체를, 그 외 역할은 공개분만.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getEvents, getUserCheckedInEventIds } from '@/lib/d1';
import type { EventWithCategory } from '@/types/gallery';
import type { MemberRole } from '@/types/members';

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

export default async function AdminLibraryCalendarPage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'library.calendar');

  const role = (session?.user?.role ?? 'user') as MemberRole;
  const userId = session?.user?.id ?? null;
  const canCheckIn = role === 'student' && !!userId;

  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonth(monthParam);
  const monthStr = ymd(year, month);

  const [eventsResult, checkedInIds] = await Promise.all([
    getEvents({ limit: 500, published: canCheckIn ? 'all' : true }),
    canCheckIn ? getUserCheckedInEventIds(userId) : Promise.resolve(new Set<number>()),
  ]);

  // 날짜별 이벤트(이번 달만)
  const byDate = new Map<string, EventWithCategory[]>();
  for (const e of eventsResult.events) {
    if (e.event_date.startsWith(monthStr)) {
      const list = byDate.get(e.event_date) ?? [];
      list.push(e);
      byDate.set(e.event_date, list);
    }
  }

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

  const monthEventCount = Array.from(byDate.values()).reduce((a, l) => a + l.length, 0);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/library">공연 · 갤러리</Link>
            <span>/</span>
            <span>캘린더</span>
          </div>
          <h1 className="admin-title">캘린더</h1>
          <p className="admin-subtitle">
            이벤트를 월별로 확인합니다. 칸의 이벤트를 누르면 상세가 열립니다.
            {canCheckIn && ' 내가 참여하는 이벤트는 금색으로 표시됩니다.'}
          </p>
        </div>
      </div>

      <div className="cal-toolbar">
        <Link href={`/admin/library/calendar?month=${ymd(prev.y, prev.m)}`} className="admin-btn admin-btn-sm admin-btn-outline">
          ← 이전
        </Link>
        <span className="cal-title">{year}년 {month}월</span>
        <Link href={`/admin/library/calendar?month=${ymd(next.y, next.m)}`} className="admin-btn admin-btn-sm admin-btn-outline">
          다음 →
        </Link>
        <Link href="/admin/library/calendar" className="admin-btn admin-btn-sm">오늘</Link>
        <span className="cal-count">이번 달 이벤트 {monthEventCount}개</span>
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
          const dayEvents = byDate.get(dateStr) ?? [];
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
                      key={e.id}
                      href={`/admin/library/${e.id}`}
                      className={`cal-event${isMine ? ' is-mine' : ''}${isDraft ? ' is-draft' : ''}`}
                      title={e.title_ko}
                    >
                      {isMine && '✓ '}
                      {e.title_ko}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {canCheckIn && (
        <div className="cal-legend">
          <span><i className="cal-swatch is-mine" /> 내가 참여</span>
          <span><i className="cal-swatch" /> 그 외 이벤트</span>
          <span><i className="cal-swatch is-draft" /> 비공개</span>
        </div>
      )}
    </div>
  );
}
