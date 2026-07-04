/**
 * Admin Glossary Create (말모이)
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getGlossaryCategories } from '@/lib/d1';
import GlossaryForm from '@/components/admin/glossary/GlossaryForm';

export const metadata = {
  title: '새 용어 | KTDOC Admin',
};

export default async function NewGlossaryTermPage() {
  const session = await auth();
  await requireMenuAccess(session, 'glossary');

  const categories = await getGlossaryCategories();

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/glossary">말모이 (용어집)</Link>
            <span>/</span>
            <span>새 용어</span>
          </div>
          <h1 className="admin-title">새 용어 추가</h1>
          <p className="admin-subtitle">한글 용어와 발음, 뜻을 입력하세요.</p>
        </div>
      </div>

      <GlossaryForm isNew categories={categories} />
    </div>
  );
}
