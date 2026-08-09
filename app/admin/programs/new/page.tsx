/**
 * Admin Program Create
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getActiveSupplyItems, getActiveSupplySets } from '@/lib/d1';
import ProgramForm from '@/components/admin/programs/ProgramForm';
import T from '@/components/common/T';

export const metadata = {
  title: '새 프로그램 | KTDOC Admin',
};

export default async function NewProgramPage() {
  const session = await auth();
  await requireMenuAccess(session, 'programs');

  const [activeSupplies, activeSupplySets] = await Promise.all([
    getActiveSupplyItems(),
    getActiveSupplySets(),
  ]);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/programs">
              <T k="admin.nav.programs">수업 · 프로그램 관리</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.programs.newCrumb">새 프로그램</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.programs.newTitle">새 프로그램 만들기</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.programs.newSubtitle">
              기본 정보를 저장한 뒤 편집 화면에서 사진을 추가하세요.
            </T>
          </p>
        </div>
      </div>

      <ProgramForm isNew activeSupplies={activeSupplies} activeSupplySets={activeSupplySets} />
    </div>
  );
}
