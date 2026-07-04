/**
 * Admin Supply Set Create (준비물 세트)
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getActiveSupplyItems } from '@/lib/d1';
import SetForm from '@/components/admin/supplies/SetForm';

export const metadata = {
  title: '새 준비물 세트 | KTDOC Admin',
};

export default async function NewSupplySetPage() {
  const session = await auth();
  await requireMenuAccess(session, 'supplies');

  const items = await getActiveSupplyItems();

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/supplies">준비물</Link>
            <span>/</span>
            <Link href="/admin/supplies/sets">세트</Link>
            <span>/</span>
            <span>새 세트</span>
          </div>
          <h1 className="admin-title">새 준비물 세트</h1>
          <p className="admin-subtitle">세트 이름을 정하고 포함할 준비물을 선택하세요.</p>
        </div>
      </div>

      <SetForm isNew items={items} />
    </div>
  );
}
