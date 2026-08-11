/**
 * 관리 콘솔 홈(/admin) — 집계만 읽어 역할에 맞는 대시보드로 넘긴다.
 *
 * 화면은 두 갈래로 나뉜다:
 *  - 원생·학부모 → StudentDashboard (알림 켜기·신청 안내·바로가기)
 *  - 운영진      → StaffDashboard  (오늘의 현황·관리실 도메인 카드)
 * 둘 다 클라이언트 컴포넌트다 — 문구를 useT로 번역하기 때문(SSR은 한국어).
 */

import type { Metadata } from 'next';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import {
  getCategories,
  getEvents,
  getGalleryPhotos,
  getPrograms,
  getApplicationCounts,
  getPublishedEventsOnDay,
} from '@/lib/d1';
import { getMemberCounts } from '@/lib/members';
import { getCalendarConfig } from '@/lib/calendar';
import { dayInTimeZone } from '@/lib/siteDay';
import type { MemberRole } from '@/types/members';
import StudentDashboard from '@/components/admin/StudentDashboard';
import StaffDashboard from '@/components/admin/StaffDashboard';
import { countUnread } from '@/lib/push/notifications';

export const metadata: Metadata = {
  title: '관리 홈 | KTDOC Admin',
};

/**
 * 오늘 열리는 공개 행사 — 두 대시보드가 함께 쓴다.
 *
 * 홈 화면 아이콘(PWA)으로 들어오면 여기가 첫 화면이라, 오늘 뭐가 있는지는
 * 스크롤 전에 보여야 한다. '오늘'은 학원 시간대로 판단한다(lib/siteDay.ts) —
 * UTC로 재면 행사 당일 저녁에 사라진다.
 */
async function getTodayEvents() {
  try {
    const { timezone } = await getCalendarConfig();
    return await getPublishedEventsOnDay(dayInTimeZone(new Date(), timezone));
  } catch {
    // 오늘 일정을 못 읽는다고 대시보드 전체가 깨지면 안 된다.
    return [];
  }
}

export default async function AdminDashboardPage() {
  const session = await auth();
  await requireMenuAccess(session, 'home');

  // 원생·학부모는 운영진 집계 대신 가벼운 마이 대시보드(알림 켜기·신청 안내)를 본다.
  const role = (session?.user?.role ?? 'user') as MemberRole;
  if (role === 'student' || role === 'parent') {
    // 이름도 이메일도 없는 계정은 역할 이름으로 부른다 — 그 문구는 클라이언트가 번역한다.
    const userName = session?.user?.name || session?.user?.email?.split('@')[0] || null;
    const [unreadCount, todayEvents] = await Promise.all([
      countUnread(session!.user!.id!).catch(() => 0),
      getTodayEvents(),
    ]);
    return (
      <StudentDashboard
        userName={userName}
        isParent={role === 'parent'}
        unreadCount={unreadCount}
        todayEvents={todayEvents}
      />
    );
  }

  const [
    programsAll,
    programsPub,
    appCounts,
    eventsPub,
    loosePhotos,
    categories,
    memberCounts,
    todayEvents,
  ] = await Promise.all([
    getPrograms({ published: 'all', limit: 1 }),
    getPrograms({ published: true, limit: 1 }),
    getApplicationCounts(),
    // 목록이 아니라 개수만 쓴다(total). 그래서 lib/d1/eventViews의 '관점'이 아니라
    // 원시 필터를 그대로 둔다 — 여기서 종류·정렬은 의미가 없다.
    getEvents({ published: true, limit: 1 }),
    getGalleryPhotos({ published: undefined, organized: 'unassigned', limit: 1 }),
    getCategories(),
    // 회원 수는 MySQL에서 조회 — 장애 시에도 대시보드가 깨지지 않도록 폴백.
    getMemberCounts().catch(() => ({ total: 0, admins: 0, users: 0, verified: 0 })),
    getTodayEvents(),
  ]);

  const adminName = session?.user?.name || session?.user?.email?.split('@')[0] || '관리자';

  return (
    <StaffDashboard
      adminName={adminName}
      programsTotal={programsAll.total}
      programsPublished={programsPub.total}
      appsTotal={appCounts.total}
      appsNew={appCounts.new}
      eventsPublished={eventsPub.total}
      loosePhotos={loosePhotos.total}
      categoryCount={categories.length}
      membersTotal={memberCounts.total}
      todayEvents={todayEvents}
    />
  );
}
