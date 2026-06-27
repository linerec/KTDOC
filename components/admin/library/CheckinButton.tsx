'use client';

import { useState } from 'react';

interface CheckinButtonProps {
  eventId: number;
  initialCheckedIn: boolean;
}

/**
 * 이벤트 참여 체크인/체크아웃 토글 (학생용).
 * 둘러보기 카드 하단에서 본인 참여 여부를 표시·전환한다.
 * 체크인 = POST, 체크아웃 = DELETE (/api/library/checkins). 대상은 서버가 본인으로 강제.
 */
export default function CheckinButton({ eventId, initialCheckedIn }: CheckinButtonProps) {
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/library/checkins', {
        method: checkedIn ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || '처리에 실패했습니다.');
      }
      setCheckedIn(!checkedIn);
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="library-checkin">
      <button
        type="button"
        className={`library-checkin-btn${checkedIn ? ' is-checked' : ''}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={checkedIn}
      >
        {busy ? '처리 중…' : checkedIn ? '✓ 참여함 · 체크인 취소' : '참여 체크인'}
      </button>
      {error && <p className="library-checkin-error">{error}</p>}
    </div>
  );
}
