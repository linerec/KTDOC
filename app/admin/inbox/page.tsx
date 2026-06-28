/**
 * Admin Inbox
 * 내 알림 — 운영진이 보낸 알림을 회원 본인이 모아 보고, 읽음/삭제한다.
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getInboxForUser } from '@/lib/push/notifications';
import InboxList from '@/components/admin/InboxList';

export const metadata = {
  title: '내 알림 | KTDOC',
};

export default async function AdminInboxPage() {
  const session = await auth();
  await requireMenuAccess(session, 'inbox');

  const items = await getInboxForUser(session!.user!.id!, 100).catch(() => []);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">홈</Link>
            <span>/</span>
            <span>내 알림</span>
          </div>
          <h1 className="admin-title">내 알림</h1>
          <p className="admin-subtitle">받은 공지·일정 알림을 모아 봅니다. 클릭하면 읽음 처리되고, 삭제할 수 있습니다.</p>
        </div>
      </div>

      <InboxList initialItems={items} />
    </div>
  );
}
