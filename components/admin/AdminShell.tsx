'use client';

/**
 * AdminShell
 * 관리자 전용 레이아웃 셸. 모든 /admin 페이지를 감싼다.
 * - 데스크톱: 좌측 고정 사이드바 + 본문
 * - 모바일: 상단바(햄버거) + 슬라이드 드로어(사이드바)
 *
 * 새 관리자 메뉴를 추가하려면 아래 NAV 배열에 항목만 추가하면 된다.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** /admin 처럼 정확히 일치할 때만 활성화 */
  exact?: boolean;
  /** 상위 항목 아래 들여쓰기 표시 */
  sub?: boolean;
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="17" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13h4l1.5 2.5h5L16 13h4" />
      <path d="M4 13 6 5.5A2 2 0 0 1 7.9 4h8.2A2 2 0 0 1 18 5.5L20 13v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function IconGallery() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3.5" width="18" height="17" rx="2" />
      <circle cx="8.5" cy="9" r="1.6" />
      <path d="m21 16-5-5L5 20.5" />
    </svg>
  );
}
function IconPhoto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5V5a2 2 0 0 1 2-2h6.5L21 12.5 12.5 21 3 11.5z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 18.5a6 6 0 0 1 11 0" />
    </svg>
  );
}

const NAV: NavItem[] = [
  { href: '/admin', label: '관리 홈', icon: <IconHome />, exact: true },
  { href: '/admin/programs', label: '수업 · 프로그램', icon: <IconCalendar /> },
  { href: '/admin/applications', label: '신청 현황', icon: <IconInbox /> },
  { href: '/admin/gallery', label: '공연 · 갤러리', icon: <IconGallery /> },
  { href: '/admin/gallery/photos', label: '사진 보관함', icon: <IconPhoto />, sub: true },
  { href: '/admin/gallery/categories', label: '이벤트 카테고리', icon: <IconTag />, sub: true },
  { href: '/admin/members', label: '회원 관리', icon: <IconUsers /> },
  { href: '/admin/profile', label: '내 프로필', icon: <IconProfile /> },
];

interface AdminShellProps {
  userName: string;
  children: ReactNode;
}

export default function AdminShell({ userName, children }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeDrawer = () => setMobileOpen(false);

  // 드로어가 열린 동안 본문 스크롤 잠금
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  // 현재 경로에 가장 길게 일치하는 항목 하나만 활성화 (상·하위 메뉴 중복 방지)
  const activeHref = useMemo(() => {
    let best = '';
    for (const item of NAV) {
      const matched = item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + '/');
      if (matched && item.href.length > best.length) best = item.href;
    }
    return best;
  }, [pathname]);

  return (
    <div className={`admin-shell${mobileOpen ? ' is-open' : ''}`}>
      {/* 사이드바 / 드로어 */}
      <aside className="admin-sidebar" aria-label="관리자 메뉴">
        <div className="admin-sidebar-brand">
          <Link href="/admin" className="admin-sidebar-wordmark" onClick={closeDrawer}>
            <span className="admin-sidebar-mark">KTDOC</span>
            <span className="admin-sidebar-sub">관리 콘솔</span>
          </Link>
        </div>

        <nav className="admin-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeDrawer}
              className={`admin-nav-link${item.sub ? ' is-sub' : ''}${
                item.href === activeHref ? ' is-active' : ''
              }`}
              aria-current={item.href === activeHref ? 'page' : undefined}
            >
              <span className="admin-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="admin-nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <Link href="/admin/profile" className="admin-sidebar-user" onClick={closeDrawer}>
            <span className="admin-sidebar-user-avatar" aria-hidden="true">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="admin-sidebar-user-name" title={userName}>
              {userName}
            </span>
          </Link>
          <Link href="/" target="_blank" className="admin-sidebar-foot-btn">
            사이트 보기 ↗
          </Link>
          <button
            type="button"
            className="admin-sidebar-foot-btn admin-sidebar-foot-btn--logout"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* 모바일 드로어 백드롭 */}
      <button
        type="button"
        className="admin-shell-backdrop"
        aria-label="메뉴 닫기"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />

      {/* 본문 */}
      <div className="admin-shell-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-topbar-burger"
            aria-label="메뉴 열기"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
          <Link href="/admin" className="admin-topbar-title">
            KTDOC <span>관리 콘솔</span>
          </Link>
        </header>

        {children}
      </div>
    </div>
  );
}
