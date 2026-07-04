/**
 * Admin Supply Edit (준비물)
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getSupplyItemById, getGlossaryTerms } from '@/lib/d1';
import SupplyForm from '@/components/admin/supplies/SupplyForm';

export const metadata = {
  title: '준비물 편집 | KTDOC Admin',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSupplyPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'supplies');

  const { id } = await params;
  const itemId = parseInt(id);
  if (isNaN(itemId)) {
    notFound();
  }

  const [item, { terms }] = await Promise.all([
    getSupplyItemById(itemId),
    getGlossaryTerms({ published: 'all', limit: 1000 }),
  ]);
  if (!item) {
    notFound();
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/supplies">준비물</Link>
            <span>/</span>
            <span>{item.name_ko}</span>
          </div>
          <h1 className="admin-title">준비물 편집</h1>
        </div>
      </div>

      <SupplyForm item={item} terms={terms} />
    </div>
  );
}
