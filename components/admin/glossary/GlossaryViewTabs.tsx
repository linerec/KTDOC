'use client';

/**
 * 말모이 뷰 전환 탭 (용어 ↔ 노래)
 * 두 목록 페이지 상단에 같은 레벨로 놓여, 클릭으로 뷰를 오간다.
 */

import Link from 'next/link';
import { useT } from '@/lib/i18n/useT';

interface GlossaryViewTabsProps {
  active: 'terms' | 'songs';
  termCount: number;
  songCount: number;
}

export default function GlossaryViewTabs({ active, termCount, songCount }: GlossaryViewTabsProps) {
  const t = useT();
  return (
    <nav className="admin-seg-tabs" aria-label={t('admin.glossary.tabsAria', '말모이 보기 전환')}>
      <Link
        href="/admin/glossary"
        className={`admin-seg-tab${active === 'terms' ? ' active' : ''}`}
        aria-current={active === 'terms' ? 'page' : undefined}
      >
        {t('admin.glossary.tabTerms', '용어')}
        <span className="admin-seg-tab-count">{termCount}</span>
      </Link>
      <Link
        href="/admin/glossary/songs"
        className={`admin-seg-tab${active === 'songs' ? ' active' : ''}`}
        aria-current={active === 'songs' ? 'page' : undefined}
      >
        {t('admin.glossary.tabSongs', '노래')}
        <span className="admin-seg-tab-count">{songCount}</span>
      </Link>
    </nav>
  );
}
