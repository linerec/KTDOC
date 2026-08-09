/**
 * 준비물 카탈로그 뷰 전환 탭 (개별 항목 ↔ 세트)
 * 두 목록 페이지 상단에 같은 레벨로 놓여, 클릭으로 뷰를 오간다.
 */

import Link from 'next/link';
import { useT } from '@/lib/i18n/useT';

interface SuppliesViewTabsProps {
  active: 'items' | 'sets';
  itemCount: number;
  setCount: number;
}

export default function SuppliesViewTabs({ active, itemCount, setCount }: SuppliesViewTabsProps) {
  const t = useT();
  return (
    <nav className="admin-seg-tabs" aria-label={t('admin.supplies.tabsAria', '준비물 보기 전환')}>
      <Link
        href="/admin/supplies"
        className={`admin-seg-tab${active === 'items' ? ' active' : ''}`}
        aria-current={active === 'items' ? 'page' : undefined}
      >
        {t('admin.supplies.tabItems', '개별 항목')}
        <span className="admin-seg-tab-count">{itemCount}</span>
      </Link>
      <Link
        href="/admin/supplies/sets"
        className={`admin-seg-tab${active === 'sets' ? ' active' : ''}`}
        aria-current={active === 'sets' ? 'page' : undefined}
      >
        {t('admin.programs.supplySets', '세트')}
        <span className="admin-seg-tab-count">{setCount}</span>
      </Link>
    </nav>
  );
}
