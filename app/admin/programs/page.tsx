/**
 * Admin Programs List
 * 수업·프로그램·캠프 목록 및 관리
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getPrograms } from '@/lib/d1';
import ProgramTable from '@/components/admin/programs/ProgramTable';
import ProgramFilters from '@/components/admin/programs/ProgramFilters';
import T from '@/components/common/T';
import { PROGRAM_TYPES, type ProgramType } from '@/types/programs';

export const metadata = {
  title: '수업 · 프로그램 관리 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{ type?: string; search?: string }>;
}

export default async function AdminProgramsPage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'programs');

  const params = await searchParams;
  const typeFilter =
    params.type && PROGRAM_TYPES.includes(params.type as ProgramType)
      ? (params.type as ProgramType)
      : undefined;

  const { programs, total } = await getPrograms({
    type: typeFilter,
    search: params.search || undefined,
    limit: 100,
    published: 'all',
  });

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.nav.programs">수업 · 프로그램 관리</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.programs">수업 · 프로그램 관리</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.programs.subtitle">
              공개 페이지에 표시될 수업·프로그램·캠프를 관리합니다. 사진은 각 프로그램 편집
              화면에서 추가합니다.
            </T>
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/applications" className="admin-btn admin-btn-outline">
            <T k="admin.programs.manageApplicants">신청자 관리</T>
          </Link>
          <Link href="/admin/programs/new" className="admin-btn admin-btn-primary">
            <T k="admin.programs.new">+ 새 프로그램 만들기</T>
          </Link>
        </div>
      </div>

      <ProgramFilters
        type={params.type || ''}
        search={params.search || ''}
        total={total}
      />

      <ProgramTable programs={programs} />
    </div>
  );
}
