'use client';

/** 뉴스·미디어 목록 상단 — 분류·공개상태 필터, 검색, 건수 */

import Link from 'next/link';
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABELS } from '@/types/news';
import { useT } from '@/lib/i18n/useT';

interface NewsFiltersProps {
  category: string;
  status: string;
  search: string;
  total: number;
}

export default function NewsFilters({ category, status, search, total }: NewsFiltersProps) {
  const t = useT();
  const hasFilter = Boolean(category || status || search);

  return (
    <div className="admin-filters">
      <form className="admin-filter-form" method="get">
        <select name="category" className="admin-filter-select" defaultValue={category}>
          <option value="">{t('admin.news.allCategories', '전체 분류')}</option>
          {NEWS_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`admin.news.category.${c}`, NEWS_CATEGORY_LABELS[c])}
            </option>
          ))}
        </select>

        <select name="status" className="admin-filter-select" defaultValue={status}>
          <option value="">{t('admin.members.allStatuses', '전체 상태')}</option>
          <option value="published">{t('admin.common.published', '공개')}</option>
          <option value="draft">{t('admin.common.unpublished', '비공개')}</option>
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
          <Link href="/admin/news" className="admin-btn admin-btn-sm admin-btn-outline">
            {t('admin.common.reset', '초기화')}
          </Link>
        )}
      </form>

      <div className="admin-filter-info">
        {t('admin.news.total', '총 {n}개의 게시물', { n: total })}
      </div>
    </div>
  );
}
