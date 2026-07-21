'use client';

/**
 * AdminMoreSheet — 모바일 하단 탭바의 '더보기' 바텀시트
 *
 * 전체 메뉴를 카테고리(그룹)로 묶어 보여준다(하단 바 직행 탭에 없는 항목까지 전부).
 * 하단에는 사이드바 하단과 같은 액션(사이트 보기·로그아웃)을 둔다.
 * 열림/닫힘 전환을 위해 항상 DOM에 두고 is-open 클래스로 토글한다. AdminShell 최상위
 * 자식(고정 위치)이라 별도 Portal 없이도 뷰포트 기준으로 배치된다. 데스크톱은 CSS로 숨긴다.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useT } from '@/lib/i18n/useT';
import AdminNavLinks from '@/components/admin/AdminNavLinks';
import type { NavMenu } from '@/types/permissions';

interface AdminMoreSheetProps {
  open: boolean;
  menus: NavMenu[];
  activeHref: string;
  showStaffMarks?: boolean;
  userName: string;
  onClose: () => void;
}

export default function AdminMoreSheet({
  open,
  menus,
  activeHref,
  showStaffMarks = false,
  userName,
  onClose,
}: AdminMoreSheetProps) {
  const t = useT();

  // 열려 있을 때 Esc로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`admin-sheet-root${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="admin-sheet-backdrop"
        aria-label={t('admin.shell.menuClose', '메뉴 닫기')}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div
        className="admin-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('admin.shell.menu', '전체 메뉴')}
        aria-hidden={!open}
      >
        <div className="admin-sheet-grip" aria-hidden="true" />
        <div className="admin-sheet-head">
          <Link
            href="/admin/profile"
            className="admin-sheet-user"
            onClick={onClose}
            tabIndex={open ? 0 : -1}
          >
            <span className="admin-sidebar-user-avatar" aria-hidden="true">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="admin-sidebar-user-name" title={userName}>
              {userName}
            </span>
          </Link>
          <button
            type="button"
            className="admin-sheet-close"
            aria-label={t('admin.shell.menuClose', '메뉴 닫기')}
            tabIndex={open ? 0 : -1}
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <nav className="admin-nav admin-sheet-nav" aria-label={t('admin.shell.navAria', '관리자 메뉴')}>
          <AdminNavLinks
            menus={menus}
            activeHref={activeHref}
            showStaffMarks={showStaffMarks}
            onNavigate={onClose}
          />
        </nav>

        <div className="admin-sheet-foot">
          <Link
            href="/"
            target="_blank"
            className="admin-sidebar-foot-btn"
            tabIndex={open ? 0 : -1}
          >
            {t('admin.shell.viewSite', '사이트 보기')} ↗
          </Link>
          <button
            type="button"
            className="admin-sidebar-foot-btn admin-sidebar-foot-btn--logout"
            tabIndex={open ? 0 : -1}
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            {t('admin.shell.logout', '로그아웃')}
          </button>
        </div>
      </div>
    </div>
  );
}
