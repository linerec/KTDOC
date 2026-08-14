'use client';

/**
 * ResponseFilters — 상태 · 검색
 *
 * 상태를 고르지 않으면 취소본은 빠진다(관점 함수 adminResponseList 의 기본값).
 * 취소된 신청을 다시 볼 경로가 없으면 안 되므로 '취소'를 고를 수 있게 둔다.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUS_OPTIONS = [
  { value: '', label: '처리 대기 · 진행 중 전체' },
  { value: 'new', label: '신규' },
  { value: 'reviewing', label: '확인 중' },
  { value: 'needs_info', label: '추가 확인 필요' },
  { value: 'accepted', label: '승인' },
  { value: 'enrolled', label: '수업 배정됨' },
  { value: 'declined', label: '거절' },
  { value: 'cancelled', label: '취소' },
];

interface ResponseFiltersProps {
  formId: number;
  status: string;
  q: string;
  total: number;
}

export default function ResponseFilters({ formId, status, q, total }: ResponseFiltersProps) {
  const router = useRouter();
  const [search, setSearch] = useState(q);

  function go(nextStatus: string, nextQ: string) {
    const params = new URLSearchParams();
    if (nextStatus) params.set('status', nextStatus);
    if (nextQ.trim()) params.set('q', nextQ.trim());
    const qs = params.toString();
    router.push(`/admin/forms/${formId}/responses${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="admin-card resp-filters">
      <div className="admin-field opt-field-narrow">
        <label htmlFor="rf-status">상태</label>
        <select id="rf-status" value={status} onChange={(e) => go(e.target.value, search)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label htmlFor="rf-q">검색</label>
        <input
          id="rf-q"
          type="text"
          value={search}
          placeholder="학생 이름 · 이메일 · 연락처 · 보호자"
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              go(status, search);
            }
          }}
        />
      </div>

      <button type="button" className="admin-btn admin-btn-outline" onClick={() => go(status, search)}>
        찾기
      </button>

      <span className="resp-filters-count">{total}건</span>
    </div>
  );
}
