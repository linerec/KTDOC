'use client';

/** 말모이 목록 상단 필터 — 용어 뷰는 분류+검색, 노래 뷰는 검색만 */

import Link from 'next/link';
import type { GlossaryCategoryWithCount } from '@/types/glossary';
import { useT } from '@/lib/i18n/useT';
import { useLocaleText } from '@/components/common/LocaleText';

interface GlossaryFiltersProps {
  /** 노래 뷰에서는 분류 셀렉트를 감춘다 */
  categories?: GlossaryCategoryWithCount[];
  category?: string;
  search: string;
  total: number;
  resetHref: string;
  /** 건수 문구 — 용어는 '개의 용어', 노래는 '곡' */
  countKey: string;
  countKo: string;
  searchPlaceholderKey: string;
  searchPlaceholderKo: string;
}

export default function GlossaryFilters({
  categories,
  category = '',
  search,
  total,
  resetHref,
  countKey,
  countKo,
  searchPlaceholderKey,
  searchPlaceholderKo,
}: GlossaryFiltersProps) {
  const t = useT();
  const pick = useLocaleText();
  const hasFilter = Boolean(category || search);

  return (
    <div className="admin-filters">
      <form className="admin-filter-form" method="get">
        {categories && (
          <select name="category" className="admin-filter-select" defaultValue={category}>
            <option value="">{t('admin.news.allCategories', '전체 분류')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {pick(c.name_ko, c.name_en)} ({c.term_count})
              </option>
            ))}
          </select>
        )}
        <input
          type="text"
          name="search"
          placeholder={t(searchPlaceholderKey, searchPlaceholderKo)}
          className="admin-filter-input"
          defaultValue={search}
        />
        <button type="submit" className="admin-btn admin-btn-sm">
          {t('admin.common.search', '검색')}
        </button>
        {hasFilter && (
          <Link href={resetHref} className="admin-btn admin-btn-sm admin-btn-outline">
            {t('admin.common.reset', '초기화')}
          </Link>
        )}
      </form>
      <div className="admin-filter-info">{t(countKey, countKo, { n: total })}</div>
    </div>
  );
}
