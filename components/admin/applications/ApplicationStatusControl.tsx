'use client';

/**
 * ApplicationStatusControl
 * 신청 상태(신규/연락함/확정/취소) 변경 드롭다운. PATCH + 낙관적 갱신.
 */

import { useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import { applicationStatusLabel } from '@/lib/i18n/applicationLabels';
import { useRouter } from 'next/navigation';
import type { ApplicationStatus } from '@/types/programs';
import { APPLICATION_STATUSES } from '@/types/programs';

interface ApplicationStatusControlProps {
  id: number;
  status: ApplicationStatus;
}

export default function ApplicationStatusControl({ id, status }: ApplicationStatusControlProps) {
  const t = useT();
  const router = useRouter();
  const [current, setCurrent] = useState<ApplicationStatus>(status);
  const [saving, setSaving] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as ApplicationStatus;
    const prev = current;
    setCurrent(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      router.refresh();
    } catch {
      setCurrent(prev);
      alert(t('admin.common.toggleFailed', '상태 변경에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      className={`admin-status-select admin-status-${current}`}
      value={current}
      onChange={handleChange}
      disabled={saving}
      aria-label={t('admin.applications.statusAria', '신청 상태 변경')}
    >
      {APPLICATION_STATUSES.map((s) => (
        <option key={s} value={s}>
          {applicationStatusLabel(t, s)}
        </option>
      ))}
    </select>
  );
}
