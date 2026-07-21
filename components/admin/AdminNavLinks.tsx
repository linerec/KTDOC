'use client';

/**
 * AdminNavLinks — 그룹(카테고리)으로 묶인 네비 링크 목록
 *
 * 데스크톱 사이드바와 모바일 '더보기' 시트가 공유하는 렌더러다.
 * 그룹이 바뀌는 첫 항목에서 섹션 소제목(라벨 있음) 또는 간격(단독 항목)을 삽입한다.
 * 라벨은 useT로 번역하고 없으면 서버가 준 한국어로 폴백한다.
 */

import { Fragment } from 'react';
import Link from 'next/link';
import { MenuIcon } from '@/lib/admin/menu-icons';
import { useT } from '@/lib/i18n/useT';
import type { NavMenu } from '@/types/permissions';

interface AdminNavLinksProps {
  menus: NavMenu[];
  activeHref: string;
  /** true면 운영진 전용(원생·학부모 미노출) 메뉴에 점을 표시. */
  showStaffMarks?: boolean;
  /** 링크 클릭 시(드로어·시트 닫기 등). */
  onNavigate?: () => void;
}

export default function AdminNavLinks({
  menus,
  activeHref,
  showStaffMarks = false,
  onNavigate,
}: AdminNavLinksProps) {
  const t = useT();

  return (
    <>
      {menus.map((item, i) => {
        // 그룹이 바뀌는 첫 항목에서 섹션 헤더(라벨 있음) 또는 간격(단독 항목)을 삽입한다.
        const groupStart = item.group !== menus[i - 1]?.group;
        return (
          <Fragment key={item.key}>
            {groupStart &&
              (item.groupLabel ? (
                <div className="admin-nav-group">
                  {t(item.groupLabelKey, item.groupLabel)}
                </div>
              ) : i > 0 ? (
                <div className="admin-nav-gap" aria-hidden="true" />
              ) : null)}
            <Link
              href={item.href}
              onClick={onNavigate}
              className={`admin-nav-link${item.sub ? ' is-sub' : ''}${
                item.href === activeHref ? ' is-active' : ''
              }`}
              aria-current={item.href === activeHref ? 'page' : undefined}
            >
              <span className="admin-nav-icon" aria-hidden="true">
                <MenuIcon iconKey={item.iconKey} />
              </span>
              <span className="admin-nav-label">
                {t(item.labelKey, item.label)}
              </span>
              {showStaffMarks && item.staffOnly && (
                <span
                  className="admin-nav-dot"
                  title={t(
                    'admin.shell.staffOnlyTitle',
                    '운영진 전용 · 원생·학부모에게는 보이지 않는 메뉴'
                  )}
                  aria-label={t('admin.shell.staffOnlyAria', '운영진 전용 메뉴')}
                />
              )}
            </Link>
          </Fragment>
        );
      })}
    </>
  );
}
