/**
 * Admin Notify
 * 알림 보내기 — 운영진(선생님·관리자)이 원생·학부모에게 푸시 알림 발송.
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getMembers } from '@/lib/members';
import { getRecentNotifications } from '@/lib/push/notifications';
import { countSubscriptions } from '@/lib/push/subscriptions';
import NotifyComposer from '@/components/admin/NotifyComposer';

export const metadata = {
  title: '알림 보내기 | KTDOC Admin',
};

export default async function AdminNotifyPage() {
  const session = await auth();
  await requireMenuAccess(session, 'notify');

  const [membersResult, recent, subscriberCount] = await Promise.all([
    getMembers({ status: 'active', limit: 500 }).catch(() => ({ members: [], total: 0 })),
    getRecentNotifications(20).catch(() => []),
    countSubscriptions().catch(() => 0),
  ]);

  const memberOptions = membersResult.members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
  }));

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">홈</Link>
            <span>/</span>
            <span>알림 보내기</span>
          </div>
          <h1 className="admin-title">알림 보내기</h1>
          <p className="admin-subtitle">
            원생·학부모에게 휴대폰 푸시 알림을 보냅니다. 알림을 켠 회원에게만 도착합니다.
            현재 알림을 켠 기기 <strong>{subscriberCount}대</strong>.
          </p>
        </div>
      </div>

      <NotifyComposer
        members={memberOptions}
        recent={recent}
        subscriberCount={subscriberCount}
      />
    </div>
  );
}
