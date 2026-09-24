'use client';

/**
 * 공연 참여 응답 — 다가오는 공연은 [참여] [불참] 두 칸, 지난 공연은 체크인 한 칸
 *
 * 둘러보기 카드·줄, 공연 상세, 학부모의 자녀별 행, 회람(/rsvp)이 모두 이것을 쓴다.
 * 예전에는 한 칸짜리 토글(참여 신청 ↔ 취소)이라 가지 않는 사람은 아무것도 누르지
 * 않았고, 운영진은 "안 간다"와 "아직 못 봤다"를 가를 수 없었다.
 *
 * 두 칸은 라디오처럼 동작한다 — 고른 칸을 다시 눌러도 아무 일도 일어나지 않고,
 * 잘못 눌렀으면 다른 칸을 누르면 된다. 고른 칸을 다시 눌러 응답이 지워지게 하면
 * 두 번 누른 손가락 하나로 '미응답'이 된다.
 *
 * 지난 공연은 응답이 아니라 기록(체크인)이라 예전 한 칸 토글을 그대로 쓴다 —
 * 지난 공연마다 [불참]이 붙으면 참여하지 않은 수십 개의 공연이 할 일처럼 보인다.
 *
 * API: /api/library/checkins (POST response='going'|'declined', DELETE=거두기).
 * 대상은 서버가 정한다 — forUserId는 학부모 대행일 때만, 보호자 관계를 서버가 검증.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/useT';
import type { EventResponse } from '@/lib/library/response';
import { checkinLabel } from './checkinLabel';

interface EventResponseButtonsProps {
  eventId: number;
  initialResponse: EventResponse | null;
  /** 다가오는 공연이면 [참여][불참], 지난 공연이면 체크인 토글 */
  upcoming: boolean;
  /** 학부모가 자녀 대신 응답할 때 자녀 id */
  forUserId?: string;
  /** 회람처럼 손가락으로 누르는 자리 — 높이 44px */
  size?: 'md' | 'lg';
  /** 폭이 좁은 자리(학부모 자녀별 행) — 지난 공연 취소 문구를 짧게 */
  compact?: boolean;
}

type Busy = EventResponse | 'clear' | null;

export default function EventResponseButtons({
  eventId,
  initialResponse,
  upcoming,
  forUserId,
  size = 'md',
  compact = false,
}: EventResponseButtonsProps) {
  const router = useRouter();
  const t = useT();
  const [response, setResponse] = useState<EventResponse | null>(initialResponse);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(next: EventResponse | null) {
    setBusy(next ?? 'clear');
    setError(null);
    try {
      const res = await fetch('/api/library/checkins', {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, forUserId, ...(next ? { response: next } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('admin.checkin.failed', '처리에 실패했습니다.'));
      }
      setResponse(next);
      // 같은 페이지의 참가자 명단·배지(서버 렌더)를 다시 불러와 반영한다.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.checkin.failed', '처리에 실패했습니다.'));
    } finally {
      setBusy(null);
    }
  }

  const sizeClass = size === 'lg' ? ' event-response--lg' : '';

  if (!upcoming) {
    const checked = response === 'going';
    return (
      <div className={`library-checkin${sizeClass}`}>
        <button
          type="button"
          className={`library-checkin-btn${checked ? ' is-checked' : ''}`}
          onClick={() => send(checked ? null : 'going')}
          disabled={busy !== null}
          aria-pressed={checked}
        >
          {checkinLabel(t, { busy: busy !== null, checked, shortCancel: compact })}
        </button>
        {error && <p className="library-checkin-error">{error}</p>}
      </div>
    );
  }

  const option = (value: EventResponse, label: string) => {
    const selected = response === value;
    return (
      <button
        type="button"
        className={`event-response-btn is-${value}${selected ? ' is-selected' : ''}`}
        onClick={() => {
          if (!selected) send(value);
        }}
        disabled={busy !== null}
        aria-pressed={selected}
      >
        {busy === value
          ? t('admin.checkin.busy', '처리 중…')
          : selected
            ? `✓ ${label}`
            : label}
      </button>
    );
  };

  return (
    <div className={`library-checkin${sizeClass}`}>
      <div
        className="event-response"
        role="group"
        aria-label={t('admin.checkin.groupLabel', '참여 여부')}
      >
        {option('going', t('admin.checkin.going', '참여'))}
        {option('declined', t('admin.checkin.decline', '불참'))}
      </div>
      {error && <p className="library-checkin-error">{error}</p>}
    </div>
  );
}
