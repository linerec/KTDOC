'use client';

/**
 * EventFilters — 공연 목록 상단의 연도·카테고리·검색 필터와 건수
 *
 * 평범한 GET 폼. 클라이언트 컴포넌트인 이유는 placeholder·옵션 라벨처럼
 * 문자열이 필요한 자리의 문구를 useT로 번역하기 때문이다.
 */

import Link from 'next/link';
import type { EventCategory } from '@/types/gallery';
import { useT } from '@/lib/i18n/useT';
import { useLocaleText } from '@/components/common/LocaleText';

interface EventFiltersProps {
  years: number[];
  categories: EventCategory[];
  year: string;
  category: string;
  search: string;
  total: number;
}

export default function EventFilters({
  years,
  categories,
  year,
  category,
  search,
  total,
}: EventFiltersProps) {
  const t = useT();
  const pick = useLocaleText();
  const hasFilter = Boolean(year || category || search);

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
          placeholder={t('admin.common.searchPlaceholder', '검색...')}
          className="admin-filter-input"
          defaultValue={search}
        />

        <button type="submit" className="admin-btn admin-btn-sm">
          {t('admin.common.search', '검색')}
        </button>

        {hasFilter && (
          <Link href="/admin/gallery" className="admin-btn admin-btn-sm admin-btn-outline">
            {t('admin.common.reset', '초기화')}
          </Link>
        )}
      </form>

      <div className="admin-filter-info">
        {t('admin.events.total', '총 {n}개의 공연', { n: total })}
      </div>
    </div>
  );
}
