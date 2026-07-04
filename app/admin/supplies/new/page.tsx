/**
 * Admin Supply Create (준비물)
 */

import Link from 'next/link';
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
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/supplies">준비물</Link>
            <span>/</span>
            <span>새 준비물</span>
          </div>
          <h1 className="admin-title">새 준비물 추가</h1>
          <p className="admin-subtitle">이름과 사진, 설명을 입력하세요.</p>
        </div>
      </div>

      <SupplyForm isNew terms={terms} />
    </div>
  );
}
