'use client';

/**
 * NotifyComposer — 알림 '보내기' 탭
 *
 * 조립만 한다: 왼쪽은 작성 폼(NotifyForm), 오른쪽은 최근 발송(NotifyHistory).
 */

import NotifyForm, { type MemberOption } from './notify/NotifyForm';
import NotifyHistory, { type NotificationLog } from './notify/NotifyHistory';

export default function NotifyComposer({
  members,
  recent,
  subscriberCount,
}: {
  members: MemberOption[];
  recent: NotificationLog[];
  subscriberCount: number;
}) {
  return (
    <div className="notify-grid">
      <NotifyForm members={members} subscriberCount={subscriberCount} />
      <NotifyHistory recent={recent} members={members} />
    </div>
  );
}
