'use client';

/**
 * StudentDashboard — 원생·학부모용 마이 대시보드(/admin 착지 화면)
 *
 * "안내받아 쉽게 등록" 두 갈래를 한 화면에 모은다:
 *  1) 알림 받기(푸시 구독) — PushOptInCard
 *  2) 수업·프로그램 신청 — 공개 신청 페이지(/classes)로 연결
 * 그리고 자주 쓰는 메뉴(캘린더·아카이브·사진 제출·프로필) 바로가기.
 *
 * 클라이언트 컴포넌트인 이유는 문구를 useT로 번역하기 때문이다 — SSR은 한국어로
 * 그려지고 하이드레이션 후 사용자 언어(localStorage['lang'])로 바뀐다.
 */

import Link from 'next/link';
import SiteViewLink from '@/components/common/SiteViewLink';
import AddToHomeCard from '@/components/admin/AddToHomeCard';
import PushOptInCard from '@/components/push/PushOptInCard';
import TodayEventBanner from '@/components/admin/TodayEventBanner';
import { useT } from '@/lib/i18n/useT';
import type { EventWithCategory } from '@/types/gallery';

interface QuickLink {
  href: string;
  /** 제목은 네비 라벨과 같은 키를 쓴다 — 메뉴와 바로가기가 같은 이름으로 불리게. */
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    href: '/admin/schedule',
    titleKey: 'admin.nav.schedule',
    titleFallback: '캘린더',
    descKey: 'admin.home.linkScheduleDesc',
    descFallback: '수업·공연 일정 한눈에',
  },
  {
    href: '/admin/my-classes',
    titleKey: 'admin.nav.my-classes',
    titleFallback: '내 수업',
    descKey: 'admin.home.linkMyClassesDesc',
    descFallback: '배정된 수업·프로그램 보기',
  },
  {
    href: '/admin/library',
    titleKey: 'admin.nav.library',
    titleFallback: '공연 둘러보기',
    descKey: 'admin.home.linkLibraryDesc',
    descFallback: '공개된 공연·행사',
  },
  {
    href: '/admin/archive',
    titleKey: 'admin.nav.archive',
    titleFallback: '내 참여 아카이브',
    descKey: 'admin.home.linkArchiveDesc',
    descFallback: '참여한 수업·공연과 사진',
  },
  // 알림을 켠 뒤 대시보드 카드가 사라지므로, 끄는 곳을 여기서 알려 준다.
  {
    href: '/admin/profile',
    titleKey: 'admin.nav.profile',
    titleFallback: '내 프로필',
    descKey: 'admin.home.linkProfileDesc',
    descFallback: '이름·비밀번호·알림·공개 설정',
  },
];

/**
 * 인사말에서 이름만 굵게. 언어마다 이름이 오는 자리가 달라서
 * ("{name}님, 반갑습니다." vs "Welcome, {name}.") 자리표시자를 기준으로 가른다.
 */
function Greeting({ template, name }: { template: string; name: string }) {
  const [head, ...tail] = template.split('{name}');
  return (
    <>
      {head}
      <b>{name}</b>
      {tail.join('{name}')}
    </>
  );
}

export default function StudentDashboard({
  userName,
  isParent,
  unreadCount,
  todayEvents,
}: {
  /** null이면 역할 이름(원생/학부모)으로 부른다 */
  userName: string | null;
  isParent: boolean;
  unreadCount: number;
  /** 오늘 열리는 공개 행사. 없으면 빈 배열 — 배너가 스스로 사라진다. */
  todayEvents: EventWithCategory[];
}) {
  const t = useT();
  const displayName =
    userName ||
    (isParent ? t('admin.member.role.parent', '학부모') : t('admin.member.role.student', '원생'));

  return (
    <div className="admin-page admin-console">
      <header className="admin-onboard-head">
        <div className="admin-onboard-headtop">
          <div>
            <p className="admin-kicker">KTDOC</p>
            <h1 className="admin-onboard-greet">
              <Greeting
                template={t('admin.home.greetMember', '{name}님, 반갑습니다.')}
                name={displayName}
              />
            </h1>
            <p className="admin-onboard-lede">
              {isParent
                ? t(
                    'admin.home.ledeParent',
                    '자녀의 공연·수업 소식을 한곳에서 확인하실 수 있습니다.'
                  )
                : t(
                    'admin.home.ledeStudent',
                    '나의 공연·수업 소식을 한곳에서 확인할 수 있어요.'
                  )}
            </p>
          </div>
          <SiteViewLink href="/" className="admin-btn admin-btn-outline" arrow>
            {t('admin.shell.viewSite', '사이트 보기')}
          </SiteViewLink>
        </div>
      </header>

      {/* 오늘 행사 — PWA로 열면 여기가 첫 화면이라 무엇보다 먼저 온다. */}
      <TodayEventBanner events={todayEvents} />

      {/* 0) 홈 화면에 추가 — 아이폰은 설치해야 알림 수신이 가능하므로 알림 카드보다 앞에.
          설치(standalone) 상태·'나중에'로 닫은 상태에서는 스스로 렌더하지 않는다. */}
      <AddToHomeCard />

      {/* 1) 알림 받기 — 온보딩 핵심. 이 기기에서 켜고 나면 사라진다(끄기·테스트는 내 프로필). */}
      <PushOptInCard placement="dashboard" audience="member" />

      {/* 2) 수업·프로그램 신청 */}
      <section className="dash-cta">
        <div className="dash-cta-body">
          <h2 className="dash-cta-title">{t('admin.home.applyTitle', '수업 · 프로그램 신청')}</h2>
          <p className="dash-cta-desc">
            {t(
              'admin.home.applyDesc',
              '정규 수업과 여름 캠프 등 모집 중인 프로그램을 둘러보고 바로 신청할 수 있습니다.'
            )}
          </p>
        </div>
        <Link href="/classes" className="admin-btn admin-btn-gold">
          {t('admin.home.applyCta', '신청하러 가기 →')}
        </Link>
      </section>

      {/* 3) 바로가기 */}
      <section className="dash-links-wrap">
        <h2 className="dash-section-title">{t('admin.home.quickLinks', '바로가기')}</h2>
        <div className="dash-links">
          <Link href="/admin/inbox" className="dash-link">
            <span className="dash-link-title">
              {t('admin.nav.inbox', '내 알림')}
              {unreadCount > 0 && <span className="dash-badge">{unreadCount}</span>}
            </span>
            <span className="dash-link-desc">
              {unreadCount > 0
                ? t('admin.home.unread', '안 읽은 알림 {n}개', { n: unreadCount })
                : t('admin.home.inboxDesc', '받은 공지·일정 알림')}
            </span>
          </Link>
          {QUICK_LINKS.map((q) => (
            <Link key={q.href} href={q.href} className="dash-link">
              <span className="dash-link-title">{t(q.titleKey, q.titleFallback)}</span>
              <span className="dash-link-desc">{t(q.descKey, q.descFallback)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
