'use client';

/**
 * ProgramFilters — 프로그램 목록 상단의 종류·검색 필터와 건수
 *
 * 평범한 GET 폼이다. 클라이언트 컴포넌트인 이유는 placeholder·옵션 라벨처럼
 * 문자열이 필요한 자리의 문구를 useT로 번역하기 때문이다.
 */

import Link from 'next/link';
import { useT } from '@/lib/i18n/useT';
import { programTypeLabel } from '@/lib/i18n/programLabels';
import { PROGRAM_TYPES } from '@/types/programs';

interface ProgramFiltersProps {
  type: string;
  search: string;
  total: number;
}

export default function ProgramFilters({ type, search, total }: ProgramFiltersProps) {
  const t = useT();
  const hasFilter = Boolean(type || search);

  return (
    <div className="admin-filters">
      <form className="admin-filter-form" method="get">
        <select name="type" className="admin-filter-select" defaultValue={type}>
          <option value="">{t('admin.programs.allTypes', '전체 종류')}</option>
          {PROGRAM_TYPES.map((pt) => (
            <option key={pt} value={pt}>
              {programTypeLabel(t, pt)}
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
          <Link href="/admin/programs" className="admin-btn admin-btn-sm admin-btn-outline">
            {t('admin.common.reset', '초기화')}
          </Link>
        )}
      </form>
      <div className="admin-filter-info">
        {t('admin.programs.total', '총 {n}개의 프로그램', { n: total })}
      </div>
    </div>
  );
}
