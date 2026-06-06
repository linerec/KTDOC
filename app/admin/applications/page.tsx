/**
 * Admin Applications Inbox
 * 신청 현황 — 프로그램별 신청자 확인 및 상태 관리
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getApplications, getApplicationCounts, getPrograms } from '@/lib/d1';
import ApplicationTable from '@/components/admin/applications/ApplicationTable';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from '@/types/programs';

export const metadata = {
  title: '신청 현황 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{ status?: string; program_id?: string; search?: string }>;
}

export default async function AdminApplicationsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!isAdmin(session)) {
    redirect('/login');
  }

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
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>신청 현황</span>
          </div>
          <h1 className="admin-title">신청 현황</h1>
          <p className="admin-subtitle">
            프로그램별 신청자를 확인하고 상태를 관리합니다. 이메일 답장 또는 전화로 바로 연락하세요.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/programs" className="admin-btn admin-btn-outline">
            프로그램 관리
          </Link>
        </div>
      </div>

      <div className="admin-filters">
        <form className="admin-filter-form" method="get">
          <select name="program_id" className="admin-filter-select" defaultValue={params.program_id || ''}>
            <option value="">전체 프로그램</option>
            {programsResult.programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title_ko}
              </option>
            ))}
          </select>
          <select name="status" className="admin-filter-select" defaultValue={params.status || ''}>
            <option value="">전체 상태</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s].ko}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="search"
            placeholder="이름·이메일·전화 검색..."
            className="admin-filter-input"
            defaultValue={params.search || ''}
          />
          <button type="submit" className="admin-btn admin-btn-sm">검색</button>
          {(params.status || params.program_id || params.search) && (
            <Link href="/admin/applications" className="admin-btn admin-btn-sm admin-btn-outline">
              초기화
            </Link>
          )}
        </form>
        <div className="admin-filter-info">
          전체 {counts.total} · <strong>신규 {counts.new}</strong>
          {total !== counts.total ? ` · 현재 목록 ${total}` : ''}
        </div>
      </div>

      <ApplicationTable applications={applications} />
    </div>
  );
}
