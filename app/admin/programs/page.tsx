/**
 * Admin Programs List
 * 수업·프로그램·캠프 목록 및 관리
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getPrograms } from '@/lib/d1';
import ProgramTable from '@/components/admin/programs/ProgramTable';
import { PROGRAM_TYPES, PROGRAM_TYPE_LABELS, type ProgramType } from '@/types/programs';

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
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>수업 · 프로그램 관리</span>
          </div>
          <h1 className="admin-title">수업 · 프로그램 관리</h1>
          <p className="admin-subtitle">
            공개 페이지에 표시될 수업·프로그램·캠프를 관리합니다. 사진은 각 프로그램 편집 화면에서 추가합니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/applications" className="admin-btn admin-btn-outline">
            신청자 관리
          </Link>
          <Link href="/admin/programs/new" className="admin-btn admin-btn-primary">
            + 새 프로그램 만들기
          </Link>
        </div>
      </div>

      <div className="admin-filters">
        <form className="admin-filter-form" method="get">
          <select name="type" className="admin-filter-select" defaultValue={params.type || ''}>
            <option value="">전체 종류</option>
            {PROGRAM_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROGRAM_TYPE_LABELS[t].ko}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="search"
            placeholder="검색..."
            className="admin-filter-input"
            defaultValue={params.search || ''}
          />
          <button type="submit" className="admin-btn admin-btn-sm">검색</button>
          {(params.type || params.search) && (
            <Link href="/admin/programs" className="admin-btn admin-btn-sm admin-btn-outline">
              초기화
            </Link>
          )}
        </form>
        <div className="admin-filter-info">총 {total}개의 프로그램</div>
      </div>

      <ProgramTable programs={programs} />
    </div>
  );
}
