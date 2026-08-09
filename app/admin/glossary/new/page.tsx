/**
 * Admin Glossary Create (말모이)
 */

import Link from 'next/link';
import T from '@/components/common/T';
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
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/glossary">
              <T k="admin.nav.glossary">말모이 (용어집)</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.glossary.newCrumb">새 용어</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.glossary.newTitle">새 용어 추가</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.glossary.newSubtitle">한글 용어와 발음, 뜻을 입력하세요.</T>
          </p>
        </div>
      </div>

      <GlossaryForm isNew categories={categories} />
    </div>
  );
}
