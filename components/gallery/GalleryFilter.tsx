'use client';

/**
 * GalleryFilter Component
 * 필터 UI - 연도, 카테고리 선택
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import type { EventCategory } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';
import IntlObject from '@/components/common/IntlObject';

interface GalleryFilterProps {
  years: number[];
  categories: EventCategory[];
}

export default function GalleryFilter({
  years,
  categories,
}: GalleryFilterProps) {
  const { locale, messages } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentYear = searchParams.get('year') || '';
  const currentCategory = searchParams.get('category') || '';
  const currentSearch = searchParams.get('search') || '';
  const currentKind = searchParams.get('kind') || '';

  const updateFilters = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      // Reset page when filters change
      params.delete('page');

      startTransition(() => {
        router.push(`/gallery?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    startTransition(() => {
      router.push('/gallery');
    });
  }, [router]);

  const hasActiveFilters = currentYear || currentCategory || currentSearch || currentKind;

  return (
    <div className={`gallery-filter ${isPending ? 'gallery-filter-pending' : ''}`}>
      <div className="gallery-filter-row">
        {/* Year Filter */}
        <div className="gallery-filter-group">
          <IntlObject keycode="gallery.filter.year" returnType="label" className="gallery-filter-label" />
          <select
            id="year-filter"
            className="gallery-filter-select"
            value={currentYear}
            onChange={(e) => updateFilters('year', e.target.value)}
          >
            <option value="">{messages['common.all'] || 'All'}</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div className="gallery-filter-group">
          <IntlObject keycode="gallery.filter.category" returnType="label" className="gallery-filter-label" />
          <select
            id="category-filter"
            className="gallery-filter-select"
            value={currentCategory}
            onChange={(e) => updateFilters('category', e.target.value)}
          >
            <option value="">{messages['common.all'] || 'All'}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {locale === 'ko' ? cat.name_ko : cat.name_en}
              </option>
            ))}
          </select>
        </div>

        {/* Kind Filter — 공연/학내 행사 */}
        <div className="gallery-filter-group">
          <IntlObject keycode="gallery.filter.kind" returnType="label" className="gallery-filter-label" />
          <select
            id="kind-filter"
            className="gallery-filter-select"
            value={currentKind}
            onChange={(e) => updateFilters('kind', e.target.value)}
          >
            <option value="">{messages['common.all'] || 'All'}</option>
            <option value="performance">
              {messages['timeline.kind.performance'] || '공연'}
            </option>
            <option value="school">
              {messages['timeline.kind.school'] || '학내 행사'}
            </option>
          </select>
        </div>

        {/* Search Input */}
        <div className="gallery-filter-group gallery-filter-search">
          <IntlObject keycode="gallery.filter.search" returnType="label" className="gallery-filter-label" />
          <input
            id="search-filter"
            type="text"
            className="gallery-filter-input"
            placeholder={messages['gallery.filter.searchPlaceholder'] || 'Search events...'}
            value={currentSearch}
            onChange={(e) => updateFilters('search', e.target.value)}
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            type="button"
            className="gallery-filter-clear"
            onClick={clearFilters}
          >
            <IntlObject keycode="gallery.filter.clear" />
          </button>
        )}
      </div>

      {/* Year Quick Links */}
      <div className="gallery-year-links">
        {years.slice(0, 10).map((year) => (
          <button
            key={year}
            type="button"
            className={`gallery-year-link ${currentYear === String(year) ? 'active' : ''}`}
            onClick={() => updateFilters('year', currentYear === String(year) ? '' : String(year))}
          >
            {year}
          </button>
        ))}
        {years.length > 10 && (
          <span className="gallery-year-more">+{years.length - 10}</span>
        )}
      </div>
    </div>
  );
}
