/**
 * Admin Applications Inbox
 * 신청 현황 — 프로그램별 신청자 확인 및 상태 관리
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getApplications, getApplicationCounts, getPrograms } from '@/lib/d1';
import ApplicationTable from '@/components/admin/applications/ApplicationTable';
import ApplicationFilters from '@/components/admin/applications/ApplicationFilters';
import T from '@/components/common/T';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/types/programs';

export const metadata = {
  title: '신청 현황 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{ status?: string; program_id?: string; search?: string }>;
}

export default async function AdminApplicationsPage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'applications');

  const params = await searchParams;
  const statusFilter =
    params.status && APPLICATION_STATUSES.includes(params.status as ApplicationStatus)
      ? (params.status as ApplicationStatus)
      : undefined;

  const [{ applications, total }, counts, programsResult] = await Promise.all([
    getApplications({
      status: statusFilter,
      program_id: params.program_id ? parseInt(params.program_id) : undefined,
      search: params.search || undefined,
      limit: 200,
    }),
    getApplicationCounts(),
    getPrograms({ published: 'all', limit: 200 }),
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
            <span>
              <T k="admin.nav.applications">신청 현황</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.applications">신청 현황</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.applications.subtitle">
              프로그램별 신청자를 확인하고 상태를 관리합니다. 이메일 답장 또는 전화로 바로
              연락하세요.
            </T>
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/programs" className="admin-btn admin-btn-outline">
            <T k="admin.home.programsManage">프로그램 관리</T>
          </Link>
        </div>
      </div>

      <ApplicationFilters
        programs={programsResult.programs}
        programId={params.program_id || ''}
        status={params.status || ''}
        search={params.search || ''}
        total={total}
        countsTotal={counts.total}
        countsNew={counts.new}
      />

      <ApplicationTable applications={applications} />
    </div>
  );
}
