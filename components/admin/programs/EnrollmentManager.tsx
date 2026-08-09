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
import { ENROLLMENT_STATUSES } from '@/types/programs';
import { useT, type TFunction } from '@/lib/i18n/useT';
import { enrollmentStatusLabel } from '@/lib/i18n/programLabels';
import type { MemberRole } from '@/types/members';

/** 수업에 배정할 수 있는 회원 — 원생과 선생님(신분에 따라 라벨이 달라진다) */
interface MemberOption {
  id: string;
  name: string | null;
  enrollment_year: number | null;
  role: MemberRole;
}

interface EnrollmentManagerProps {
  programId: number;
  initialEnrollments: EnrollmentWithMember[];
  memberOptions: MemberOption[];
}

/**
 * 드롭다운 한 줄. 원생은 입학년도로, 선생님은 '선생님'으로 구분한다 —
 * 한 목록에 섞여 나오므로 누구인지 보이지 않으면 잘못 고르기 쉽다.
 */
function memberLabel(t: TFunction, m: MemberOption): string {
  const base = m.name || t('admin.common.noNameEntered', '이름 미입력');
  if (m.role === 'teacher') return `${base} · ${t('admin.member.role.teacher', '선생님')}`;
  return m.enrollment_year
    ? `${base} · ${t('admin.members.yearSuffix', '{y}년', { y: m.enrollment_year })}`
    : base;
}

export default function EnrollmentManager({
  programId,
  initialEnrollments,
  memberOptions,
}: EnrollmentManagerProps) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [addStatus, setAddStatus] = useState<EnrollmentStatus>('active');

  const enrolledIds = new Set(initialEnrollments.map((e) => e.user_id));
  const available = memberOptions.filter((s) => !enrolledIds.has(s.id));
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
      setError(t('admin.enroll.pickFirst', '배정할 원생을 선택하세요.'));
      return;
    }
    const ok = await call(
      `/api/admin/programs/${programId}/enrollments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedId, status: addStatus }),
      },
      t('admin.enroll.addFailed', '수강생 배정에 실패했습니다.')
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
      t('admin.common.toggleFailed', '상태 변경에 실패했습니다.')
    );
  }

  function handleRemove(enrollmentId: number, name: string | null) {
    if (
      !confirm(
        t('admin.enroll.removeConfirm', '{name}의 배정을 해제할까요?', {
          name: name || t('admin.enroll.thisStudent', '이 원생'),
        })
      )
    )
      return;
    void call(
      `/api/admin/programs/${programId}/enrollments/${enrollmentId}`,
      { method: 'DELETE' },
      t('admin.enroll.removeFailed', '배정 해제에 실패했습니다.')
    );
  }

  return (
    <div>
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      {memberOptions.length === 0 ? (
        <p className="admin-form-help">
          {t(
            'admin.enroll.noStudents',
            '아직 등록된 원생 회원이 없습니다. 회원 관리에서 원생 가입을 승인하면 이곳에서 배정할 수 있습니다.'
          )}
        </p>
      ) : (
        <div className="admin-form-row" style={{ alignItems: 'flex-end', gap: '8px' }}>
          <div className="admin-form-group" style={{ flex: 2 }}>
            <label className="admin-form-label">{t('admin.enroll.pickStudent', '원생 선택')}</label>
            <select
              className="admin-form-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={busy || available.length === 0}
            >
              <option value="">
                {available.length === 0
                  ? t('admin.enroll.allAssigned', '배정할 수 있는 사람이 모두 배정되었습니다')
                  : t('admin.enroll.selectPrompt', '배정할 사람을 선택하세요')}
              </option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>
                  {memberLabel(t, m)}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-group" style={{ flex: 1 }}>
            <label className="admin-form-label">{t('admin.members.colStatus', '상태')}</label>
            <select
              className="admin-form-select"
              value={addStatus}
              onChange={(e) => setAddStatus(e.target.value as EnrollmentStatus)}
              disabled={busy}
            >
              {ENROLLMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {enrollmentStatusLabel(t, s)}
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
            {t('admin.enroll.assign', '배정')}
          </button>
        </div>
      )}

      <p className="admin-form-help" style={{ marginTop: '12px' }}>
        {t('admin.enroll.countLine', '배정된 수강생 {n}명', { n: activeCount })}
        {cancelledCount > 0
          ? ` · ${t('admin.enroll.cancelledCount', '취소 {n}명', { n: cancelledCount })}`
          : ''}
      </p>

      {initialEnrollments.length === 0 ? (
        <p className="admin-form-help">
          {t('admin.enroll.empty', '아직 배정된 수강생이 없습니다.')}
        </p>
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
                {e.member_name || t('admin.common.noNameEntered', '이름 미입력')}
                {e.enrollment_year ? (
                  <span style={{ fontWeight: 400, opacity: 0.6 }}>
                    {' · '}
                    {t('admin.members.yearSuffix', '{y}년', { y: e.enrollment_year })}
                  </span>
                ) : null}
              </span>
              <select
                className="admin-form-select"
                style={{ width: 'auto', minWidth: '110px' }}
                value={e.status}
                onChange={(ev) => handleStatusChange(e.id, ev.target.value as EnrollmentStatus)}
                disabled={busy}
                aria-label={t('admin.enroll.statusAria', '{name} 수강 상태', {
                  name: e.member_name || t('admin.member.role.student', '원생'),
                })}
              >
                {ENROLLMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {enrollmentStatusLabel(t, s)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={() => handleRemove(e.id, e.member_name)}
                disabled={busy}
              >
                {t('admin.enroll.remove', '해제')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
