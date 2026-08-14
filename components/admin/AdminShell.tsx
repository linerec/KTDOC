'use client';

/**
 * AdminShell
 * 관리자 콘솔 레이아웃 셸. 모든 /admin 페이지를 감싼다.
 * - 데스크톱: 좌측 고정 사이드바 + 본문
 * - 모바일: 상단 브랜드 바 + 하단 탭바(웹앱 톤). '더보기' 탭이 전체 메뉴 시트를 연다.
 *
 * 표시할 메뉴(menus)는 서버(app/admin/layout.tsx)가 권한 매트릭스로 계산해 전달한다.
 * 메뉴 정의는 lib/admin/menu-registry.ts에서 관리한다(여기서 하드코딩하지 않는다).
 * 그룹형 네비 렌더는 AdminNavLinks(사이드바·시트 공유), 하단 바는 AdminBottomNav,
 * 전체 메뉴 시트는 AdminMoreSheet가 담당한다.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useT } from '@/lib/i18n/useT';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import SiteViewLink from '@/components/common/SiteViewLink';
import AdminNavLinks from '@/components/admin/AdminNavLinks';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import AdminMoreSheet from '@/components/admin/AdminMoreSheet';
import AdminThemeToggle from '@/components/admin/AdminThemeToggle';
import HeaderWaves from '@/components/HeaderWaves';
import type { NavMenu } from '@/types/permissions';

interface AdminShellProps {
  userName: string;
  menus: NavMenu[];
  children: ReactNode;
  /** 사이드바/모바일 헤더의 부제목. 멤버는 "마이페이지", 운영진은 "관리 콘솔". */
  consoleLabel?: string;
  /** 부제목 번역 키코드. 없으면 consoleLabel(한국어)로 폴백. */
  consoleLabelKey?: string;
  /** true면 운영진 전용(원생·학부모 미노출) 메뉴에 점을 표시(운영진 뷰 전용). */
  showStaffMarks?: boolean;
}

export default function AdminShell({
  userName,
  menus,
  children,
  consoleLabel = '관리 콘솔',
  consoleLabelKey,
  showStaffMarks = false,
}: AdminShellProps) {
  const pathname = usePathname();
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);

  // 셸 크롬(부제목·하단 액션·aria)은 useT로 번역하고 한국어로 폴백한다.
  const consoleLabelText = consoleLabelKey
    ? t(consoleLabelKey, consoleLabel)
    : consoleLabel;

  // 시트가 열린 동안 본문 스크롤 잠금
  useEffect(() => {
    if (moreOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [moreOpen]);

  // 현재 경로에 가장 길게 일치하는 메뉴 하나만 활성화 (상·하위 메뉴 중복 방지).
  // 사이드바에서 감춘 자식 페이지(alsoActiveFor, 예: Q&A 관리)에 서 있으면 부모가 켜진다.
  const activeHref = useMemo(() => {
    let best = '';
    let bestLen = 0;
    for (const item of menus) {
      for (const href of [item.href, ...item.alsoActiveFor]) {
        const matched =
          href === '/admin'
            ? pathname === '/admin'
            : pathname === href || pathname.startsWith(href + '/');
        if (matched && href.length > bestLen) {
          best = item.href; // 켜지는 것은 언제나 목록에 있는 항목이다
          bestLen = href.length;
        }
      }
    }
    return best;
  }, [pathname, menus]);

  return (
    <div className="admin-shell">
      {/* 사이드바 (데스크톱) */}
      <aside className="admin-sidebar" aria-label={t('admin.shell.navAria', '관리자 메뉴')}>
        <div className="admin-sidebar-brand">
          {/* 공개 헤더 Top Bar와 같은 붓질 선 애니메이션 — 워드마크 뒤에 깔린다.
              헤더와 동일한 환경변수로 끌 수 있다. */}
          {process.env.NEXT_PUBLIC_HEADER_WAVES !== 'off' && (
            <HeaderWaves className="admin-brand-waves" />
          )}
          <Link href="/admin" className="admin-sidebar-wordmark">
            <span className="admin-sidebar-mark">KTDOC</span>
            <span className="admin-sidebar-sub">{consoleLabelText}</span>
          </Link>
        </div>

        <nav className="admin-nav">
          <AdminNavLinks
            menus={menus}
            activeHref={activeHref}
            showStaffMarks={showStaffMarks}
          />
        </nav>

        <div className="admin-sidebar-foot">
          <Link href="/admin/profile" className="admin-sidebar-user">
            <span className="admin-sidebar-user-avatar" aria-hidden="true">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="admin-sidebar-user-name" title={userName}>
              {userName}
            </span>
          </Link>
          <SiteViewLink href="/" className="admin-sidebar-foot-btn" arrow>
            {t('admin.shell.viewSite', '사이트 보기')}
          </SiteViewLink>
          <button
            type="button"
            className="admin-sidebar-foot-btn admin-sidebar-foot-btn--logout"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            {t('admin.shell.logout', '로그아웃')}
          </button>
        </div>
      </aside>

      {/* 본문 */}
      <div className="admin-shell-main">
        <header className="admin-topbar">
          {/* 모바일 상단바의 붓질 선 — 사이드바가 숨는 ≤900px에서만 보인다(CSS).
              데스크톱은 사이드바 브랜드의 선이 같은 역할을 한다. */}
          {process.env.NEXT_PUBLIC_HEADER_WAVES !== 'off' && (
            <HeaderWaves className="admin-topbar-waves" />
          )}
          <Link href="/admin" className="admin-topbar-title">
            KTDOC <span>{consoleLabelText}</span>
          </Link>
          <LanguageSwitcher className="admin-topbar-lang" />
          <AdminThemeToggle />
        </header>

        {children}
      </div>

      {/* 모바일 하단 탭바 + 전체 메뉴 시트 */}
      <AdminBottomNav
        menus={menus}
        activeHref={activeHref}
        moreOpen={moreOpen}
        onMore={() => setMoreOpen((v) => !v)}
      />
      <AdminMoreSheet
        open={moreOpen}
        menus={menus}
        activeHref={activeHref}
        showStaffMarks={showStaffMarks}
        userName={userName}
        onClose={() => setMoreOpen(false)}
      />
    </div>
  );
}
