'use client';

/**
 * NotifyComposer — 알림 '보내기' 탭
 *
 * 조립만 한다: 왼쪽은 작성 폼(NotifyForm), 오른쪽은 최근 발송(NotifyHistory).
 */

import NotifyForm, { type MemberOption, type ProgramOption } from './notify/NotifyForm';
import NotifyHistory, { type NotificationLog } from './notify/NotifyHistory';

export default function NotifyComposer({
  members,
  programs,
  recent,
  subscriberCount,
}: {
  members: MemberOption[];
  programs: ProgramOption[];
  recent: NotificationLog[];
  subscriberCount: number;
}) {
  return (
    <div className="notify-grid">
      <NotifyForm members={members} programs={programs} subscriberCount={subscriberCount} />
      <NotifyHistory recent={recent} members={members} programs={programs} />
    </div>
  );
}
