'use client';

/** 사진 보관함 툴바 — 검색, 분류·공개·출처·공연·정렬 필터, 보기 밀도, 건수 */

import EventPicker from '../EventPicker';
import { useT } from '@/lib/i18n/useT';
import type {
  FilterState,
  OrganizedFilter,
  PublishedFilter,
  SortOrder,
  SubmittedFilter,
  ViewDensity,
} from './types';

interface PhotoToolbarProps {
  filters: FilterState;
  searchInput: string;
  onSearchInput: (v: string) => void;
  onApplyFilters: (next: Partial<FilterState>) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  loading: boolean;
  filterEventLabel: string | null;
  onFilterEventLabel: (v: string | null) => void;
  viewDensity: ViewDensity;
  onViewDensity: (v: ViewDensity) => void;
  total: number;
  rangeStart: number;
  rangeEnd: number;
}

export default function PhotoToolbar({
  filters,
  searchInput,
  onSearchInput,
  onApplyFilters,
  onResetFilters,
  hasActiveFilters,
  loading,
  filterEventLabel,
  onFilterEventLabel,
  viewDensity,
  onViewDensity,
  total,
  rangeStart,
  rangeEnd,
}: PhotoToolbarProps) {
  const t = useT();

  return (
    <div className="photo-organize-toolbar">
      <form
        className="photo-organize-search"
        onSubmit={(e) => {
          e.preventDefault();
          onApplyFilters({ search: searchInput });
        }}
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => onSearchInput(e.target.value)}
          placeholder={t('admin.photos.searchPlaceholder', '캡션·공연으로 검색')}
          className="admin-filter-input"
        />
        <button type="submit" className="admin-btn admin-btn-sm" disabled={loading}>
          {t('admin.common.search', '검색')}
        </button>
      </form>

      <div className="photo-organize-filters">
        <select
          className="admin-filter-select"
          value={filters.organized}
          onChange={(e) => onApplyFilters({ organized: e.target.value as OrganizedFilter })}
          disabled={loading}
          aria-label={t('admin.photos.organizedAria', '정리 상태')}
        >
          <option value="all">{t('admin.photos.allOrganized', '전체 분류상태')}</option>
          <option value="assigned">{t('admin.photos.assigned', '공연에 들어있음')}</option>
          <option value="unassigned">{t('admin.photos.unassigned', '미분류')}</option>
        </select>

        <select
          className="admin-filter-select"
          value={filters.published}
          onChange={(e) => onApplyFilters({ published: e.target.value as PublishedFilter })}
          disabled={loading}
          aria-label={t('admin.common.colPublished', '공개 상태')}
        >
          <option value="all">{t('admin.photos.allPublished', '전체 공개상태')}</option>
          <option value="public">{t('admin.common.published', '공개')}</option>
          <option value="private">{t('admin.common.unpublished', '비공개')}</option>
        </select>

        <select
          className="admin-filter-select"
          value={filters.submitted}
          onChange={(e) => onApplyFilters({ submitted: e.target.value as SubmittedFilter })}
          disabled={loading}
          aria-label={t('admin.photos.sourceAria', '제출 출처')}
        >
          <option value="all">{t('admin.photos.allSources', '전체 출처')}</option>
          <option value="student">{t('admin.photos.fromStudent', '학생 제출')}</option>
          <option value="staff">{t('admin.photos.fromStaff', '직접 업로드')}</option>
        </select>

        <EventPicker
          value={filters.eventId === '' ? null : filters.eventId}
          valueLabel={filterEventLabel}
          placeholder={t('admin.photos.allEvents', '전체 공연')}
          allowClear
          clearLabel={t('admin.photos.allEvents', '전체 공연')}
          disabled={loading}
          buttonClassName="photo-organize-event-filter"
          onChange={(id, ev) => {
            onFilterEventLabel(ev ? `${ev.year} · ${ev.title_ko}` : null);
            onApplyFilters({ eventId: id ?? '' });
          }}
        />

        <select
          className="admin-filter-select"
          value={filters.sort}
          onChange={(e) => onApplyFilters({ sort: e.target.value as SortOrder })}
          disabled={loading}
          aria-label={t('admin.photos.sortAria', '정렬')}
        >
          <option value="recent">{t('admin.photos.sortRecent', '최신 업로드순')}</option>
          <option value="oldest">{t('admin.photos.sortOldest', '오래된 업로드순')}</option>
          <option value="taken">{t('admin.photos.sortTaken', '촬영일순')}</option>
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-outline"
            onClick={onResetFilters}
            disabled={loading}
          >
            {t('admin.common.reset', '초기화')}
          </button>
        )}
      </div>

      <div className="photo-organize-toolbar-right">
        <div
          className="photo-organize-density"
          role="group"
          aria-label={t('admin.photos.densityAria', '보기 밀도')}
        >
          <button
            type="button"
            className={`admin-btn admin-btn-sm ${viewDensity === 'compact' ? 'admin-btn-primary' : 'admin-btn-outline'}`}
            onClick={() => onViewDensity('compact')}
          >
            {t('admin.photos.densityCompact', '조밀')}
          </button>
          <button
            type="button"
            className={`admin-btn admin-btn-sm ${viewDensity === 'comfortable' ? 'admin-btn-primary' : 'admin-btn-outline'}`}
            onClick={() => onViewDensity('comfortable')}
          >
            {t('admin.photos.densityComfortable', '보통')}
          </button>
        </div>
        <span className="photo-organize-count">
          {total > 0
            ? t('admin.photos.range', '{from}–{to} / 총 {total}장', {
                from: rangeStart,
                to: rangeEnd,
                total,
              })
            : t('admin.photos.rangeEmpty', '0장')}
        </span>
      </div>
    </div>
  );
}
