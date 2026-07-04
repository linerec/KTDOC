/**
 * Admin Glossary Edit (말모이)
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getGlossaryTermById, getGlossaryCategories } from '@/lib/d1';
import GlossaryForm from '@/components/admin/glossary/GlossaryForm';

export const metadata = {
  title: '용어 편집 | KTDOC Admin',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditGlossaryTermPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'glossary');

  const { id } = await params;
  const termId = parseInt(id);
  if (isNaN(termId)) {
    notFound();
  }

  const [term, categories] = await Promise.all([
    getGlossaryTermById(termId),
    getGlossaryCategories(),
  ]);
  if (!term) {
    notFound();
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/glossary">말모이 (용어집)</Link>
            <span>/</span>
            <span>{term.term_ko}</span>
          </div>
          <h1 className="admin-title">용어 편집</h1>
        </div>
      </div>

      <GlossaryForm term={term} categories={categories} />
    </div>
  );
}
