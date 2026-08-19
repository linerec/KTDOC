'use client';

/** 둘러보기 상단 — 연도·카테고리·검색 필터, 바로가기, 보기 전환, 건수 */

import Link from 'next/link';
import type { EventCategory } from '@/types/gallery';
import { useT } from '@/lib/i18n/useT';
import { useLocaleText } from '@/components/common/LocaleText';
import LibraryViewToggle, { type LibraryView } from './LibraryViewToggle';

interface LibraryFiltersProps {
  years: number[];
  categories: EventCategory[];
  year: string;
  category: string;
  search: string;
  hasFilters: boolean;
  /** 참여 표시·필터를 보여줄지 — 본인 체크인(학생·운영진) 또는 자녀 체크인(학부모) */
  canCheckIn: boolean;
  mineOnly: boolean;
  checkedInCount: number;
  displayCount: number;
  view: LibraryView;
  cardHref: string;
  listHref: string;
}

export default function LibraryFilters({
  years,
  categories,
  year,
  category,
  search,
  hasFilters,
  canCheckIn,
  mineOnly,
  checkedInCount,
  displayCount,
  view,
  cardHref,
  listHref,
}: LibraryFiltersProps) {
  const t = useT();
  const pick = useLocaleText();

  const countLabel = mineOnly
    ? t('admin.library.countMine', '체크인한 공연 {n}개', { n: displayCount })
    : canCheckIn
      ? t('admin.library.countAll', '공연 {n}개', { n: displayCount })
      : t('admin.library.countPublic', '공개된 공연 {n}개', { n: displayCount });

  return (
    <div className="admin-filters">
      <form className="admin-filter-form" method="get">
        <select name="year" className="admin-filter-select" defaultValue={year}>
          <option value="">{t('admin.events.allYears', '전체 연도')}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select name="category" className="admin-filter-select" defaultValue={category}>
          <option value="">{t('admin.events.allCategories', '전체 카테고리')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug}>
              {pick(cat.name_ko, cat.name_en)}
            </option>
          ))}
        </select>

        <input
          type="text"
          name="search"
          placeholder={t('admin.library.searchPlaceholder', '제목 검색...')}
          className="admin-filter-input"
          defaultValue={search}
        />

        <button type="submit" className="admin-btn admin-btn-sm">
          {t('admin.common.search', '검색')}
        </button>

        {hasFilters && (
          <Link href="/admin/library" className="admin-btn admin-btn-sm admin-btn-outline">
            {t('admin.common.reset', '초기화')}
          </Link>
        )}

        {canCheckIn && (
          <Link
            href={mineOnly ? '/admin/library' : '/admin/library?mine=1'}
            className={`admin-btn admin-btn-sm ${mineOnly ? '' : 'admin-btn-outline'}`}
          >
            {mineOnly
              ? t('admin.library.showAll', '전체 보기')
              : t('admin.library.showMine', '✓ 체크인한 것만 ({n})', { n: checkedInCount })}
          </Link>
        )}

        <Link href="/admin/schedule" className="admin-btn admin-btn-sm admin-btn-outline">
          📅 {t('admin.nav.schedule', '캘린더')}
        </Link>

        {canCheckIn && (
          <Link href="/admin/archive" className="admin-btn admin-btn-sm admin-btn-outline">
            {t('admin.nav.archive', '내 참여 아카이브')} →
          </Link>
        )}
      </form>

      <div className="admin-filter-side">
        <LibraryViewToggle view={view} cardHref={cardHref} listHref={listHref} />
        <div className="admin-filter-info">{countLabel}</div>
      </div>
    </div>
  );
}
