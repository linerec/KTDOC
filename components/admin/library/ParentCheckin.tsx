'use client';

import { useT } from '@/lib/i18n/useT';
import type { EventResponse } from '@/lib/library/response';
import EventResponseButtons from './EventResponseButtons';

interface Child {
  studentId: string;
  studentName: string | null;
  /** 이 자녀의 현재 응답(참여·불참·미응답) */
  response: EventResponse | null;
}

interface ParentCheckinProps {
  eventId: number;
  childrenList: Child[];
  /** 다가오는 공연이면 [참여][불참], 지난 공연이면 체크인 토글 */
  upcoming?: boolean;
}

/**
 * 학부모 대행 응답 — 연결된 자녀별로 공연 참여·불참을 고른다.
 * 버튼은 EventResponseButtons 하나를 쓰고, forUserId(자녀 id)를 넘긴다.
 * 보호자 관계는 서버가 검증한다.
 */
export default function ParentCheckin({ eventId, childrenList, upcoming = false }: ParentCheckinProps) {
  const t = useT();

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
      {childrenList.map((c) => (
        <div key={c.studentId} className="parent-checkin-row">
          <span className="parent-checkin-name">
            {c.studentName || t('admin.myClasses.child', '자녀')}
          </span>
          <EventResponseButtons
            eventId={eventId}
            forUserId={c.studentId}
            initialResponse={c.response}
            upcoming={upcoming}
            compact
          />
        </div>
      ))}
    </div>
  );
}
