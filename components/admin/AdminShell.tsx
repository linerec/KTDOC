'use client';

/**
 * AdminShell
 * 관리자 콘솔 레이아웃 셸. 모든 /admin 페이지를 감싼다.
 * - 데스크톱: 좌측 고정 사이드바 + 본문
 * - 모바일: 상단바(햄버거) + 슬라이드 드로어(사이드바)
 *
 * 표시할 메뉴(menus)는 서버(app/admin/layout.tsx)가 권한 매트릭스로 계산해 전달한다.
 * 메뉴 정의는 lib/admin/menu-registry.ts에서 관리한다(여기서 하드코딩하지 않는다).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { MenuIcon } from '@/lib/admin/menu-icons';
import type { NavMenu } from '@/types/permissions';

interface AdminShellProps {
  userName: string;
  menus: NavMenu[];
  children: ReactNode;
  /** 사이드바/모바일 헤더의 부제목. 멤버는 "마이페이지", 운영진은 "관리 콘솔". */
  consoleLabel?: string;
}

export default function AdminShell({
  userName,
  menus,
  children,
  consoleLabel = '관리 콘솔',
}: AdminShellProps) {
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

  // 현재 경로에 가장 길게 일치하는 메뉴 하나만 활성화 (상·하위 메뉴 중복 방지)
  const activeHref = useMemo(() => {
    let best = '';
    for (const item of menus) {
      const matched =
        item.href === '/admin'
          ? pathname === '/admin'
          : pathname === item.href || pathname.startsWith(item.href + '/');
      if (matched && item.href.length > best.length) best = item.href;
    }
    return best;
  }, [pathname, menus]);

  return (
    <div className={`admin-shell${mobileOpen ? ' is-open' : ''}`}>
      {/* 사이드바 / 드로어 */}
      <aside className="admin-sidebar" aria-label="관리자 메뉴">
        <div className="admin-sidebar-brand">
          <Link href="/admin" className="admin-sidebar-wordmark" onClick={closeDrawer}>
            <span className="admin-sidebar-mark">KTDOC</span>
            <span className="admin-sidebar-sub">{consoleLabel}</span>
          </Link>
        </div>

        <nav className="admin-nav">
          {menus.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={closeDrawer}
              className={`admin-nav-link${item.sub ? ' is-sub' : ''}${
                item.href === activeHref ? ' is-active' : ''
              }`}
              aria-current={item.href === activeHref ? 'page' : undefined}
            >
              <span className="admin-nav-icon" aria-hidden="true">
                <MenuIcon iconKey={item.iconKey} />
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
            KTDOC <span>{consoleLabel}</span>
          </Link>
        </header>

        {children}
      </div>
    </div>
  );
}
