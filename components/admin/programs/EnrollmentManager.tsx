'use client';

/**
 * EnrollmentManager
 * 프로그램 편집 화면의 '수강생' 섹션 — 운영진이 원생(회원)을 배정/상태변경/해제한다.
 *
 * 배정·변경·해제는 API 호출 후 router.refresh()로 서버 데이터를 다시 받아 목록을 갱신한다
 * (program 편집 폼과 독립된 형제 영역 — <form> 중첩을 피한다).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EnrollmentWithMember, EnrollmentStatus } from '@/types/programs';
import { ENROLLMENT_STATUSES, ENROLLMENT_STATUS_LABELS } from '@/types/programs';

interface StudentOption {
  id: string;
  name: string | null;
  enrollment_year: number | null;
}

interface EnrollmentManagerProps {
  programId: number;
  initialEnrollments: EnrollmentWithMember[];
  studentOptions: StudentOption[];
}

function studentLabel(name: string | null, year: number | null): string {
  const base = name || '이름 미입력';
  return year ? `${base} · ${year}년` : base;
}

export default function EnrollmentManager({
  programId,
  initialEnrollments,
  studentOptions,
}: EnrollmentManagerProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [addStatus, setAddStatus] = useState<EnrollmentStatus>('active');

  const enrolledIds = new Set(initialEnrollments.map((e) => e.user_id));
  const available = studentOptions.filter((s) => !enrolledIds.has(s.id));
  const activeCount = initialEnrollments.filter((e) => e.status !== 'cancelled').length;
  const cancelledCount = initialEnrollments.length - activeCount;

  async function call(url: string, options: RequestInit, fallbackMsg: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, options);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || fallbackMsg);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : fallbackMsg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    if (!selectedId) {
      setError('배정할 원생을 선택하세요.');
      return;
    }
    const ok = await call(
      `/api/admin/programs/${programId}/enrollments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedId, status: addStatus }),
      },
      '수강생 배정에 실패했습니다.'
    );
    if (ok) {
      setSelectedId('');
      setAddStatus('active');
    }
  }

  function handleStatusChange(enrollmentId: number, status: EnrollmentStatus) {
    void call(
      `/api/admin/programs/${programId}/enrollments/${enrollmentId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      },
      '상태 변경에 실패했습니다.'
    );
  }

  function handleRemove(enrollmentId: number, name: string | null) {
    if (!confirm(`${name || '이 원생'}의 배정을 해제할까요?`)) return;
    void call(
      `/api/admin/programs/${programId}/enrollments/${enrollmentId}`,
      { method: 'DELETE' },
      '배정 해제에 실패했습니다.'
    );
  }

  return (
    <div>
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      {studentOptions.length === 0 ? (
        <p className="admin-form-help">
          아직 등록된 원생 회원이 없습니다. 회원 관리에서 원생 가입을 승인하면 이곳에서 배정할 수 있습니다.
        </p>
      ) : (
        <div className="admin-form-row" style={{ alignItems: 'flex-end', gap: '8px' }}>
          <div className="admin-form-group" style={{ flex: 2 }}>
            <label className="admin-form-label">원생 선택</label>
            <select
              className="admin-form-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={busy || available.length === 0}
            >
              <option value="">
                {available.length === 0 ? '모든 원생이 이미 배정되었습니다' : '원생을 선택하세요'}
              </option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {studentLabel(s.name, s.enrollment_year)}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-group" style={{ flex: 1 }}>
            <label className="admin-form-label">상태</label>
            <select
              className="admin-form-select"
              value={addStatus}
              onChange={(e) => setAddStatus(e.target.value as EnrollmentStatus)}
              disabled={busy}
            >
              {ENROLLMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ENROLLMENT_STATUS_LABELS[s].ko}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleAdd}
            disabled={busy || !selectedId}
          >
            배정
          </button>
        </div>
      )}

      <p className="admin-form-help" style={{ marginTop: '12px' }}>
        배정된 수강생 {activeCount}명
        {cancelledCount > 0 ? ` · 취소 ${cancelledCount}명` : ''}
      </p>

      {initialEnrollments.length === 0 ? (
        <p className="admin-form-help">아직 배정된 수강생이 없습니다.</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {initialEnrollments.map((e) => (
            <li
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                border: '1px solid rgba(224, 184, 79, 0.16)',
                borderRadius: '8px',
                opacity: e.status === 'cancelled' ? 0.55 : 1,
              }}
            >
              <span style={{ flex: 1, fontWeight: 600 }}>
                {e.member_name || '이름 미입력'}
                {e.enrollment_year ? (
                  <span style={{ fontWeight: 400, opacity: 0.6 }}> · {e.enrollment_year}년</span>
                ) : null}
              </span>
              <select
                className="admin-form-select"
                style={{ width: 'auto', minWidth: '110px' }}
                value={e.status}
                onChange={(ev) => handleStatusChange(e.id, ev.target.value as EnrollmentStatus)}
                disabled={busy}
                aria-label={`${e.member_name || '원생'} 수강 상태`}
              >
                {ENROLLMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ENROLLMENT_STATUS_LABELS[s].ko}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={() => handleRemove(e.id, e.member_name)}
                disabled={busy}
              >
                해제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
