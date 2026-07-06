'use client';

/**
 * MediaFilter Component
 * 뉴스 & 미디어 분류 필터 탭 (전체 · 소식 · 언론 보도 · 영상)
 * searchParams(category) 링크 방식 — 서버 컴포넌트가 필터된 목록을 다시 렌더한다.
 */

import Link from 'next/link';
import type { NewsCategory } from '@/types/news';
import IntlObject from '@/components/common/IntlObject';

interface MediaFilterProps {
  active?: NewsCategory;
}

const TABS: { key: NewsCategory | undefined; keycode: string }[] = [
  { key: undefined, keycode: 'media.filter.all' },
  { key: 'news', keycode: 'media.filter.news' },
  { key: 'press', keycode: 'media.filter.press' },
  { key: 'video', keycode: 'media.filter.video' },
];

export default function MediaFilter({ active }: MediaFilterProps) {
  return (
    <div className="media-filter">
      {TABS.map((tab) => (
        <Link
          key={tab.key ?? 'all'}
          href={tab.key ? `/media?category=${tab.key}` : '/media'}
          className={`media-filter-tab${active === tab.key ? ' is-active' : ''}`}
          scroll={false}
        >
          <IntlObject keycode={tab.keycode} />
        </Link>
      ))}
    </div>
  );
}
