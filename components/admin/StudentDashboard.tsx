/**
 * StudentDashboard — 원생·학부모용 마이 대시보드(/admin 착지 화면)
 *
 * "안내받아 쉽게 등록" 두 갈래를 한 화면에 모은다:
 *  1) 알림 받기(푸시 구독) — PushOptInCard
 *  2) 수업·프로그램 신청 — 공개 신청 페이지(/classes)로 연결
 * 그리고 자주 쓰는 메뉴(캘린더·아카이브·사진 제출·프로필) 바로가기.
 */

import Link from 'next/link';
import SiteViewLink from '@/components/common/SiteViewLink';
import AddToHomeCard from '@/components/admin/AddToHomeCard';
import PushOptInCard from '@/components/push/PushOptInCard';

interface QuickLink {
  href: string;
  title: string;
  desc: string;
}

const QUICK_LINKS: QuickLink[] = [
  { href: '/admin/schedule', title: '캘린더', desc: '수업·공연 일정 한눈에' },
  { href: '/admin/my-classes', title: '내 수업', desc: '배정된 수업·프로그램 보기' },
  { href: '/admin/library', title: '공연 둘러보기', desc: '공개된 공연·행사' },
  { href: '/admin/archive', title: '내 참여 아카이브', desc: '참여한 수업·공연과 사진' },
  // 알림을 켠 뒤 대시보드 카드가 사라지므로, 끄는 곳을 여기서 알려 준다.
  { href: '/admin/profile', title: '내 프로필', desc: '이름·비밀번호·알림·공개 설정' },
];

export default function StudentDashboard({
  userName,
  isParent,
  unreadCount,
}: {
  userName: string;
  isParent: boolean;
  unreadCount: number;
}) {
  return (
    <div className="admin-page admin-console">
      <header className="admin-onboard-head">
        <div className="admin-onboard-headtop">
          <div>
            <p className="admin-kicker">KTDOC</p>
            <h1 className="admin-onboard-greet">
              <b>{userName}</b>님, 반갑습니다.
            </h1>
            <p className="admin-onboard-lede">
              {isParent
                ? '자녀의 공연·수업 소식을 한곳에서 확인하실 수 있습니다.'
                : '나의 공연·수업 소식을 한곳에서 확인할 수 있어요.'}
            </p>
          </div>
          <SiteViewLink href="/" className="admin-btn admin-btn-outline" arrow>
            사이트 보기
          </SiteViewLink>
        </div>
      </header>

      {/* 0) 홈 화면에 추가 — 아이폰은 설치해야 알림 수신이 가능하므로 알림 카드보다 앞에.
          설치(standalone) 상태·'나중에'로 닫은 상태에서는 스스로 렌더하지 않는다. */}
      <AddToHomeCard />

      {/* 1) 알림 받기 — 온보딩 핵심. 이 기기에서 켜고 나면 사라진다(끄기·테스트는 내 프로필). */}
      <PushOptInCard placement="dashboard" audience="member" />

      {/* 2) 수업·프로그램 신청 */}
      <section className="dash-cta">
        <div className="dash-cta-body">
          <h2 className="dash-cta-title">수업 · 프로그램 신청</h2>
          <p className="dash-cta-desc">
            정규 수업과 여름 캠프 등 모집 중인 프로그램을 둘러보고 바로 신청할 수 있습니다.
          </p>
        </div>
        <Link href="/classes" className="admin-btn admin-btn-gold">
          신청하러 가기 →
        </Link>
      </section>

      {/* 3) 바로가기 */}
      <section className="dash-links-wrap">
        <h2 className="dash-section-title">바로가기</h2>
        <div className="dash-links">
          <Link href="/admin/inbox" className="dash-link">
            <span className="dash-link-title">
              내 알림
              {unreadCount > 0 && <span className="dash-badge">{unreadCount}</span>}
            </span>
            <span className="dash-link-desc">
              {unreadCount > 0 ? `안 읽은 알림 ${unreadCount}개` : '받은 공지·일정 알림'}
            </span>
          </Link>
          {QUICK_LINKS.map((q) => (
            <Link key={q.href} href={q.href} className="dash-link">
              <span className="dash-link-title">{q.title}</span>
              <span className="dash-link-desc">{q.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
