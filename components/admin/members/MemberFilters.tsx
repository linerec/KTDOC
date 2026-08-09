'use client';

/**
 * MemberFilters — 회원 목록 상단의 상태·역할·검색 필터와 집계 줄
 *
 * 필터는 평범한 GET 폼이다(제출하면 쿼리스트링이 붙은 같은 주소로 이동).
 * 클라이언트 컴포넌트인 이유는 placeholder·옵션 라벨처럼 "문자열이 필요한 자리"의
 * 문구를 useT로 번역하기 때문이다 — <T> 조각으로는 닿지 않는 자리다.
 */

import Link from 'next/link';
import { useT } from '@/lib/i18n/useT';
import { roleLabel, statusLabel } from '@/lib/i18n/memberLabels';
import {
  MEMBER_ROLES,
  MEMBER_STATUSES,
  type MemberCounts,
} from '@/types/members';

interface MemberFiltersProps {
  counts: MemberCounts;
  /** 현재 필터가 걸린 목록의 건수 */
  total: number;
  status: string;
  role: string;
  search: string;
}

export default function MemberFilters({
  counts,
  total,
  status,
  role,
  search,
}: MemberFiltersProps) {
  const t = useT();
  const hasFilter = Boolean(status || role || search);

  return (
    <div className="admin-filters">
      <form className="admin-filter-form" method="get">
        <select name="status" className="admin-filter-select" defaultValue={status}>
          <option value="">{t('admin.members.allStatuses', '전체 상태')}</option>
          {MEMBER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(t, s)}
            </option>
          ))}
        </select>
        <select name="role" className="admin-filter-select" defaultValue={role}>
          <option value="">{t('admin.members.allRoles', '전체 역할')}</option>
          {MEMBER_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(t, r)}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="search"
          placeholder={t('admin.members.searchPlaceholder', '이름·이메일 검색...')}
          className="admin-filter-input"
          defaultValue={search}
        />
        <button type="submit" className="admin-btn admin-btn-sm">
          {t('admin.common.search', '검색')}
        </button>
        {hasFilter && (
          <Link href="/admin/members" className="admin-btn admin-btn-sm admin-btn-outline">
            {t('admin.common.reset', '초기화')}
          </Link>
        )}
      </form>
      <div className="admin-filter-info">
        {t(
          'admin.members.countsLine',
          '전체 {total} · 대기 {pending} · 원생 {students} · 학부모 {parents} · 선생님 {teachers} · 관리자 {admins}',
          {
            total: counts.total,
            pending: counts.pending,
            students: counts.students,
            parents: counts.parents,
            teachers: counts.teachers,
            admins: counts.admins,
          }
        )}
        {hasFilter ? ` · ${t('admin.members.countsFiltered', '현재 목록 {n}', { n: total })}` : ''}
      </div>
    </div>
  );
}
