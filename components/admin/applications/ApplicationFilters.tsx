'use client';

/** 신청 목록 상단 — 프로그램·상태 필터, 검색, 건수 */

import Link from 'next/link';
import { APPLICATION_STATUSES } from '@/types/programs';
import { useT } from '@/lib/i18n/useT';
import { useLocaleText } from '@/components/common/LocaleText';
import { applicationStatusLabel } from '@/lib/i18n/applicationLabels';

interface ProgramOption {
  id: number;
  title_ko: string;
  title_en: string | null;
}

interface ApplicationFiltersProps {
  programs: ProgramOption[];
  programId: string;
  status: string;
  search: string;
  total: number;
  countsTotal: number;
  countsNew: number;
}

export default function ApplicationFilters({
  programs,
  programId,
  status,
  search,
  total,
  countsTotal,
  countsNew,
}: ApplicationFiltersProps) {
  const t = useT();
  const pick = useLocaleText();
  const hasFilter = Boolean(programId || status || search);

  return (
    <div className="admin-filters">
      <form className="admin-filter-form" method="get">
        <select name="program_id" className="admin-filter-select" defaultValue={programId}>
          <option value="">{t('admin.applications.allPrograms', '전체 프로그램')}</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {pick(p.title_ko, p.title_en)}
            </option>
          ))}
        </select>
        <select name="status" className="admin-filter-select" defaultValue={status}>
          <option value="">{t('admin.members.allStatuses', '전체 상태')}</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {applicationStatusLabel(t, s)}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="search"
          placeholder={t('admin.applications.searchPlaceholder', '이름·이메일·전화 검색...')}
          className="admin-filter-input"
          defaultValue={search}
        />
        <button type="submit" className="admin-btn admin-btn-sm">
          {t('admin.common.search', '검색')}
        </button>
        {hasFilter && (
          <Link href="/admin/applications" className="admin-btn admin-btn-sm admin-btn-outline">
            {t('admin.common.reset', '초기화')}
          </Link>
        )}
      </form>
      <div className="admin-filter-info">
        {t('admin.applications.countTotal', '전체 {n}', { n: countsTotal })} ·{' '}
        <strong>{t('admin.applications.countNew', '신규 {n}', { n: countsNew })}</strong>
        {total !== countsTotal
          ? ` · ${t('admin.members.countsFiltered', '현재 목록 {n}', { n: total })}`
          : ''}
      </div>
    </div>
  );
}
