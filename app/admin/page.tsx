import type { Metadata } from 'next';
import Link from 'next/link';
import SiteViewLink from '@/components/common/SiteViewLink';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getCategories, getEvents, getGalleryPhotos, getPrograms, getApplicationCounts } from '@/lib/d1';
import { getMemberCounts } from '@/lib/members';
import type { MemberRole } from '@/types/members';
import StudentDashboard from '@/components/admin/StudentDashboard';
import PushOptInCard from '@/components/push/PushOptInCard';
import { countUnread } from '@/lib/push/notifications';

export const metadata: Metadata = {
  title: '관리 홈 | KTDOC Admin',
};

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="17" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13h4l1.5 2.5h5L16 13h4" />
      <path d="M4 13 6 5.5A2 2 0 0 1 7.9 4h8.2A2 2 0 0 1 18 5.5L20 13v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function IconGallery() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3.5" width="18" height="17" rx="2" />
      <circle cx="8.5" cy="9" r="1.6" />
      <path d="m21 16-5-5L5 20.5" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default async function AdminDashboardPage() {
  const session = await auth();
  await requireMenuAccess(session, 'home');

  // 원생·학부모는 운영진 집계 대신 가벼운 마이 대시보드(알림 켜기·신청 안내)를 본다.
  const role = (session?.user?.role ?? 'user') as MemberRole;
  if (role === 'student' || role === 'parent') {
    const userName =
      session?.user?.name ||
      session?.user?.email?.split('@')[0] ||
      (role === 'parent' ? '학부모' : '원생');
    const unreadCount = await countUnread(session!.user!.id!).catch(() => 0);
    return (
      <StudentDashboard
        userName={userName}
        isParent={role === 'parent'}
        unreadCount={unreadCount}
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
  ]);

  const programsTotal = programsAll.total;
  const programsPublished = programsPub.total;
  const appsTotal = appCounts.total;
  const appsNew = appCounts.new;
  const eventsPublished = eventsPub.total;
  const loose = loosePhotos.total;
  const categoryCount = categories.length;
  const membersTotal = memberCounts.total;

  const adminName = session?.user?.name || session?.user?.email?.split('@')[0] || '관리자';
  const isFreshSite = programsTotal === 0 && eventsPublished === 0 && appsTotal === 0;
  const hasNewApps = appsNew > 0;

  return (
    <div className="admin-page admin-console">
      {/* 환영 헤더 */}
      <header className="admin-onboard-head">
        <div className="admin-onboard-headtop">
          <div>
            <p className="admin-kicker">KTDOC ADMIN</p>
            <h1 className="admin-onboard-greet">
              <b>{adminName}</b>님, {isFreshSite ? '환영합니다.' : '안녕하세요.'}
            </h1>
            <p className="admin-onboard-lede">
              {isFreshSite
                ? '춤누리 홈페이지를 관리하는 공간입니다.'
                : `오늘의 현황 — 공개 수업 ${programsPublished} · 새 신청 ${appsNew} · 공개 공연 ${eventsPublished}`}
            </p>
          </div>
          <SiteViewLink href="/" className="admin-btn admin-btn-outline" arrow>
            사이트 보기
          </SiteViewLink>
        </div>
      </header>

      {/* 긴급: 새 신청 (페이지 내 유일한 빨강 강조) */}
      {hasNewApps && (
        <section className="admin-urgent-callout">
          <p>가장 먼저 처리할 일 — 새 신청 {appsNew}건이 답변을 기다리고 있습니다</p>
          <Link href="/admin/applications" className="admin-btn admin-btn-danger">
            신청자 보기
          </Link>
        </section>
      )}

      {/* 알림 받기 — 운영진도 받는 쪽이다. 새 가입 신청 알림(lib/push/system.ts)은
          이미 teacher·admin을 대상으로 발송되지만, 기기를 등록해 두지 않으면 도착할
          곳이 없어 알림함에만 쌓인다. 이 기기에서 켜고 나면 카드는 사라진다. */}
      <PushOptInCard
        hideWhenEnabled
        lede="새 가입 신청 등 확인이 필요한 일을 휴대폰 알림으로 받아보세요. 기기마다 한 번씩 켜야 합니다."
      />

      {/* 관리실 — 기존 기능 도메인 (항상 존재) */}
      <section className={`admin-workshop${isFreshSite ? ' admin-workshop--quiet' : ''}`}>
        <div className="admin-workshop-head">
          <h2>관리실</h2>
        </div>
        {isFreshSite && (
          <p className="admin-workshop-quiet-line">
            익숙해지신 뒤에는 이곳에서 바로 관리하실 수 있습니다 — 프로그램 · 신청 · 회원 · 공연
          </p>
        )}

        <div className="admin-domains">
          <section className="admin-domain admin-domain--accent">
            <div className="admin-domain-top">
              <span className="admin-domain-icon">
                <IconCalendar />
              </span>
              <span className="admin-domain-stat-inline">
                <strong>{programsTotal}</strong>
                <span>개 프로그램</span>
              </span>
            </div>
            <h2 className="admin-domain-title">수업 · 프로그램 · 캠프</h2>
            <p className="admin-domain-desc">
              방문자에게 보여줄 수업과 여름 캠프를 등록하고, 공개 여부와 사진을 관리합니다.
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/programs" className="admin-btn admin-btn-primary">
                프로그램 관리
              </Link>
              <Link href="/admin/programs/new" className="admin-btn admin-btn-outline">
                + 새로 만들기
              </Link>
            </div>
          </section>

          <section className={`admin-domain${appsNew > 0 ? ' admin-domain--alert' : ''}`}>
            <div className="admin-domain-top">
              <span className="admin-domain-icon">
                <IconInbox />
              </span>
              {appsNew > 0 ? (
                <span className="admin-domain-flag">● 신규 {appsNew}</span>
              ) : (
                <span className="admin-domain-stat-inline">
                  <strong>{appsTotal}</strong>
                  <span>건</span>
                </span>
              )}
            </div>
            <h2 className="admin-domain-title">신청 현황</h2>
            <p className="admin-domain-desc">
              수업·캠프 신청자를 확인하고, 이메일·전화로 바로 연락합니다.
            </p>
            <p className="admin-domain-meta">
              신규 {appsNew} · 전체 {appsTotal}
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/applications" className="admin-btn admin-btn-primary">
                신청자 보기
              </Link>
            </div>
          </section>

          <section className="admin-domain">
            <div className="admin-domain-top">
              <span className="admin-domain-icon">
                <IconUsers />
              </span>
              <span className="admin-domain-stat-inline">
                <strong>{membersTotal}</strong>
                <span>명 회원</span>
              </span>
            </div>
            <h2 className="admin-domain-title">회원 관리</h2>
            <p className="admin-domain-desc">
              사이트에 가입한 회원을 확인합니다. 이메일·가입일·권한을 한눈에 볼 수 있습니다.
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/members" className="admin-btn admin-btn-primary">
                회원 목록 보기
              </Link>
            </div>
          </section>

          <section className="admin-domain admin-domain--wide">
            <div className="admin-domain-top">
              <span className="admin-domain-icon">
                <IconGallery />
              </span>
              <div className="admin-domain-stats">
                <span className="admin-domain-stat">
                  <strong>{eventsPublished}</strong>
                  <span>공개 공연</span>
                </span>
                <span className="admin-domain-stat">
                  <strong>{loose}</strong>
                  <span>미정리 사진</span>
                </span>
                <span className="admin-domain-stat">
                  <strong>{categoryCount}</strong>
                  <span>카테고리</span>
                </span>
              </div>
            </div>
            <h2 className="admin-domain-title">공연 관리</h2>
            <p className="admin-domain-desc">
              공연·행사 기록과 현장 사진·영상을 관리하고, 대표 공연을 공연 페이지 쇼케이스에 노출합니다.
              연도별 아카이브는 갤러리 페이지에 표시됩니다.
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/gallery" className="admin-btn admin-btn-primary">
                공연 관리
              </Link>
              <Link href="/admin/gallery/new" className="admin-btn admin-btn-outline">
                + 새 공연
              </Link>
              <Link href="/admin/gallery/photos" className="admin-btn admin-btn-outline">
                사진 보관함
              </Link>
            </div>
          </section>
        </div>
      </section>

      {/* 안내 풋노트 */}
      <div className="admin-guide-footnote">
        <span>로그인한 상태에서 홈페이지를 열고 상단의 &lsquo;편집&rsquo;을 켜면, 페이지의 글과 사진을 그 자리에서 직접 수정할 수 있습니다. 코드를 다룰 필요가 없습니다.</span>
      </div>
    </div>
  );
}
