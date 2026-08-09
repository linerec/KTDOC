/**
 * Admin Supply Set Edit (준비물 세트)
 */

import { notFound } from 'next/navigation';
import T from '@/components/common/T';
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
            <span>{set.name_ko}</span>
          </div>
          <h1 className="admin-title">
            <T k="admin.sets.editTitle">세트 편집</T>
          </h1>
        </div>
      </div>

      <SetForm set={set} items={items} />
    </div>
  );
}
