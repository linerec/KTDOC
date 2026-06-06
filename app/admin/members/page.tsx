/**
 * Admin Members
 * 회원 관리 — 사이트에 가입한 회원 목록 조회 (현재 조회 전용)
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import {
  getMembers,
  getMemberCounts,
  MEMBER_ROLES,
  MEMBER_ROLE_LABELS,
  type MemberRole,
} from '@/lib/members';
import MemberTable from '@/components/admin/members/MemberTable';

export const metadata = {
  title: '회원 관리 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{ role?: string; search?: string }>;
}

export default async function AdminMembersPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!isAdmin(session)) {
    redirect('/login');
  }

  const params = await searchParams;
  const roleFilter =
    params.role && MEMBER_ROLES.includes(params.role as MemberRole)
      ? (params.role as MemberRole)
      : undefined;

  const [{ members, total }, counts] = await Promise.all([
    getMembers({
      role: roleFilter,
      search: params.search || undefined,
      limit: 200,
    }),
    getMemberCounts(),
  ]);

  const hasFilter = Boolean(params.role || params.search);

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
            사이트에 가입한 회원을 확인합니다. 이메일·가입일·권한을 한눈에 볼 수 있어요.
          </p>
        </div>
      </div>

      <div className="admin-filters">
        <form className="admin-filter-form" method="get">
          <select name="role" className="admin-filter-select" defaultValue={params.role || ''}>
            <option value="">전체 권한</option>
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
          전체 {counts.total} · 관리자 {counts.admins} · 일반 {counts.users}
          {hasFilter ? ` · 현재 목록 ${total}` : ''}
        </div>
      </div>

      <MemberTable members={members} />
    </div>
  );
}
