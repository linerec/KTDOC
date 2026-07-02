/**
 * Admin Program Create
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import ProgramForm from '@/components/admin/programs/ProgramForm';

export const metadata = {
  title: '새 프로그램 | KTDOC Admin',
};

export default async function NewProgramPage() {
  const session = await auth();
  await requireMenuAccess(session, 'programs');

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/programs">수업 · 프로그램 관리</Link>
            <span>/</span>
            <span>새 프로그램</span>
          </div>
          <h1 className="admin-title">새 프로그램 만들기</h1>
          <p className="admin-subtitle">기본 정보를 저장한 뒤 편집 화면에서 사진을 추가하세요.</p>
        </div>
      </div>

      <ProgramForm isNew />
    </div>
  );
}
