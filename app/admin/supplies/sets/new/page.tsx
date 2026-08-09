/**
 * Admin Supply Set Create (준비물 세트)
 */

import Link from 'next/link';
import T from '@/components/common/T';
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
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/supplies">
              <T k="admin.nav.supplies">준비물</T>
            </Link>
            <span>/</span>
            <Link href="/admin/supplies/sets">
              <T k="admin.programs.supplySets">세트</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.sets.newCrumb">새 세트</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.sets.newTitle">새 준비물 세트</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.sets.newSubtitle">세트 이름을 정하고 포함할 준비물을 선택하세요.</T>
          </p>
        </div>
      </div>

      <SetForm isNew items={items} />
    </div>
  );
}
