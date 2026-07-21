'use client';

/**
 * AdminBottomNav — 모바일 하단 탭바(웹앱 톤)
 *
 * 역할이 볼 수 있는 메뉴 중 핵심 페이지 N개를 직행 탭으로, 마지막은 '더보기'로 둔다.
 * '더보기'는 전체 카테고리 메뉴 시트(AdminMoreSheet)를 연다.
 * 데스크톱에서는 CSS로 숨기고(사이드바 사용), 모바일에서만 노출한다.
 */

import Link from 'next/link';
import { MenuIcon } from '@/lib/admin/menu-icons';
import { useT } from '@/lib/i18n/useT';
import { pickBottomNav } from '@/lib/admin/bottomNav';
import type { NavMenu } from '@/types/permissions';

interface AdminBottomNavProps {
  menus: NavMenu[];
  activeHref: string;
  /** '더보기' 시트 열림 여부(열려 있으면 더보기 탭 강조). */
  moreOpen: boolean;
  onNavigate?: () => void;
  onMore: () => void;
}

export default function AdminBottomNav({
  menus,
  activeHref,
  moreOpen,
  onNavigate,
  onMore,
}: AdminBottomNavProps) {
  const t = useT();
  const tabs = pickBottomNav(menus, 4);

  // 현재 페이지가 직행 탭에 없으면 '더보기'를 활성으로 표시한다.
  const activeInTabs = tabs.some((tab) => tab.href === activeHref);
  const moreActive = moreOpen || !activeInTabs;

  return (
    <nav className="admin-bottomnav" aria-label={t('admin.shell.navAria', '관리자 메뉴')}>
      {tabs.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          onClick={onNavigate}
          className={`admin-bottomnav-item${
            item.href === activeHref ? ' is-active' : ''
          }`}
          aria-current={item.href === activeHref ? 'page' : undefined}
        >
          <span className="admin-bottomnav-icon" aria-hidden="true">
            <MenuIcon iconKey={item.iconKey} />
          </span>
          <span className="admin-bottomnav-label">
            {t(item.labelKey, item.label)}
          </span>
        </Link>
      ))}
      <button
        type="button"
        className={`admin-bottomnav-item admin-bottomnav-more${
          moreActive ? ' is-active' : ''
        }`}
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        onClick={onMore}
      >
        <span className="admin-bottomnav-icon" aria-hidden="true">
          <MenuIcon iconKey="more" />
        </span>
        <span className="admin-bottomnav-label">
          {t('admin.shell.more', '더보기')}
        </span>
      </button>
    </nav>
  );
}
