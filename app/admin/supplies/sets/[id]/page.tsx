/**
 * Admin Supply Set Edit (준비물 세트)
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getSupplySetById, getActiveSupplyItems } from '@/lib/d1';
import SetForm from '@/components/admin/supplies/SetForm';

export const metadata = {
  title: '세트 편집 | KTDOC Admin',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSupplySetPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'supplies');

  const { id } = await params;
  const setId = parseInt(id);
  if (isNaN(setId)) {
    notFound();
  }

  const [set, items] = await Promise.all([
    getSupplySetById(setId),
    getActiveSupplyItems(),
  ]);
  if (!set) {
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
            <Link href="/admin/supplies/sets">세트</Link>
            <span>/</span>
            <span>{set.name_ko}</span>
          </div>
          <h1 className="admin-title">세트 편집</h1>
        </div>
      </div>

      <SetForm set={set} items={items} />
    </div>
  );
}
