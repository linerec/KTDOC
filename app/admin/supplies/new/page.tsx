/**
 * Admin Supply Create (준비물)
 */

import Link from 'next/link';
import T from '@/components/common/T';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getGlossaryTerms } from '@/lib/d1';
import SupplyForm from '@/components/admin/supplies/SupplyForm';

export const metadata = {
  title: '새 준비물 | KTDOC Admin',
};

export default async function NewSupplyPage() {
  const session = await auth();
  await requireMenuAccess(session, 'supplies');

  const { terms } = await getGlossaryTerms({ published: 'all', limit: 1000 });

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
            <span>
              <T k="admin.supplies.newCrumb">새 준비물</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.supplies.newTitle">새 준비물 추가</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.supplies.newSubtitle">이름과 사진, 설명을 입력하세요.</T>
          </p>
        </div>
      </div>

      <SupplyForm isNew terms={terms} />
    </div>
  );
}
