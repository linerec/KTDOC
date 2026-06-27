/**
 * Admin Members
 * 회원 관리 — 가입 회원 조회 + 승인/거절/역할 변경.
 * 접근: 운영진(선생님·관리자). 역할 변경은 관리자만.
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { requireMenuAccess } from '@/lib/admin/permissions';
import {
  getMembers,
  getMemberCounts,
  getStudentOptions,
  MEMBER_ROLES,
  MEMBER_ROLE_LABELS,
  MEMBER_STATUSES,
  MEMBER_STATUS_LABELS,
  type MemberRole,
  type MemberStatus,
} from '@/lib/members';
import MemberTable from '@/components/admin/members/MemberTable';

export const metadata = {
  title: '회원 관리 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{ role?: string; status?: string; search?: string }>;
}

export default async function AdminMembersPage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'members');
  const canManageRoles = isAdmin(session);

  const params = await searchParams;
  const roleFilter =
    params.role && MEMBER_ROLES.includes(params.role as MemberRole)
      ? (params.role as MemberRole)
      : undefined;
  const statusFilter =
    params.status && MEMBER_STATUSES.includes(params.status as MemberStatus)
      ? (params.status as MemberStatus)
      : undefined;

  const [{ members, total }, counts, students] = await Promise.all([
    getMembers({
      role: roleFilter,
      status: statusFilter,
      search: params.search || undefined,
      limit: 300,
    }),
    getMemberCounts(),
    getStudentOptions(),
  ]);

  const hasFilter = Boolean(params.role || params.status || params.search);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>회원 관리</span>
          </div>
          <h1 className="admin-title">회원 관리</h1>
          <p className="admin-subtitle">
            가입한 원생·학부모를 확인하고 승인합니다. 승인해야 정회원으로 이용할 수 있습니다.
          </p>
        </div>
      </div>

      {counts.pending > 0 && (
        <div className="admin-callout">
          승인 대기 중인 회원이 <strong>{counts.pending}명</strong> 있습니다.
          {!statusFilter && (
            <Link href="/admin/members?status=pending" className="admin-callout-link">
              대기 회원만 보기 →
            </Link>
          )}
        </div>
      )}

      <div className="admin-filters">
        <form className="admin-filter-form" method="get">
          <select name="status" className="admin-filter-select" defaultValue={params.status || ''}>
            <option value="">전체 상태</option>
            {MEMBER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MEMBER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select name="role" className="admin-filter-select" defaultValue={params.role || ''}>
            <option value="">전체 역할</option>
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {MEMBER_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="search"
            placeholder="이름·이메일 검색..."
            className="admin-filter-input"
            defaultValue={params.search || ''}
          />
          <button type="submit" className="admin-btn admin-btn-sm">검색</button>
          {hasFilter && (
            <Link href="/admin/members" className="admin-btn admin-btn-sm admin-btn-outline">
              초기화
            </Link>
          )}
        </form>
        <div className="admin-filter-info">
          전체 {counts.total} · 대기 {counts.pending} · 원생 {counts.students} · 학부모 {counts.parents}
          {' · '}선생님 {counts.teachers} · 관리자 {counts.admins}
          {hasFilter ? ` · 현재 목록 ${total}` : ''}
        </div>
      </div>

      <MemberTable
        members={members}
        students={students}
        canManageRoles={canManageRoles}
      />
    </div>
  );
}
