'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/useT';
import { checkinLabel } from './checkinLabel';

interface Child {
  studentId: string;
  studentName: string | null;
  checkedIn: boolean;
}

interface ParentCheckinProps {
  eventId: number;
  childrenList: Child[];
  /** 다가오는 공연면 "참여 예정", 지난 공연면 "참여함" */
  upcoming?: boolean;
}

/**
 * 학부모 대행 체크인 — 연결된 자녀별로 공연 참여를 토글한다.
 * API에 forUserId(자녀 id)를 보내며, 서버가 보호자 관계를 검증한다.
 */
export default function ParentCheckin({ eventId, childrenList, upcoming = false }: ParentCheckinProps) {
  const router = useRouter();
  const t = useT();
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(childrenList.map((c) => [c.studentId, c.checkedIn]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(studentId: string) {
    const checked = state[studentId];
    setBusy(studentId);
    setError(null);
    try {
      const res = await fetch('/api/library/checkins', {
        method: checked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, forUserId: studentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('admin.checkin.failed', '처리에 실패했습니다.'));
      }
      setState((s) => ({ ...s, [studentId]: !checked }));
      // 참가자 목록(서버 렌더)을 즉시 반영
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.checkin.failed', '처리에 실패했습니다.'));
    } finally {
      setBusy(null);
    }
  }

  if (childrenList.length === 0) {
    return (
      <p className="parent-checkin-empty">
        {t(
          'admin.checkin.noChildren',
          '연결된 자녀가 없습니다. 자녀가 먼저 원생으로 가입·승인되고 보호자 연결이 확정되어야 대행 체크인을 할 수 있습니다.'
        )}
      </p>
    );
  }

  return (
    <div className="parent-checkin">
      {childrenList.map((c) => {
        const checked = state[c.studentId];
        return (
          <div key={c.studentId} className="parent-checkin-row">
            <span className="parent-checkin-name">
              {c.studentName || t('admin.myClasses.child', '자녀')}
            </span>
            <button
              type="button"
              className={`library-checkin-btn${checked ? ' is-checked' : ''}`}
              onClick={() => toggle(c.studentId)}
              disabled={busy === c.studentId}
              aria-pressed={checked}
            >
              {checkinLabel(t, {
                busy: busy === c.studentId,
                checked,
                upcoming,
                shortCancel: true,
              })}
            </button>
          </div>
        );
      })}
      {error && <p className="library-checkin-error">{error}</p>}
    </div>
  );
}
