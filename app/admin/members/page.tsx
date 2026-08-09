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
  MEMBER_STATUSES,
  type MemberRole,
  type MemberStatus,
} from '@/lib/members';
import { getDeviceCountsByUser } from '@/lib/push/tracking';
import MemberTable from '@/components/admin/members/MemberTable';
import MemberFilters from '@/components/admin/members/MemberFilters';
import TestAccountsPanel from '@/components/admin/members/TestAccountsPanel';
import T from '@/components/common/T';

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

  // 회원별 알림(푸시) 기기 수 — 목록에서 바로 "이 사람에게 알림이 가나"를 본다.
  // 조회가 실패해도 회원 관리 자체는 열려야 하므로 빈 값으로 흘린다.
  const pushDevices = await getDeviceCountsByUser(members.map((m) => m.id)).catch(() => ({}));

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
              <T k="admin.nav.members">회원 관리</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.members">회원 관리</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.members.subtitle">
              가입한 원생·학부모를 확인하고 승인합니다. 승인해야 정회원으로 이용할 수 있습니다.
            </T>
          </p>
        </div>
      </div>

      {canManageRoles && <TestAccountsPanel />}

      {counts.pending > 0 && (
        <div className="admin-callout">
          <T
            k="admin.members.pendingCallout"
            params={{ n: <strong>{counts.pending}</strong> }}
          >
            {'승인 대기 중인 회원이 {n}명 있습니다.'}
          </T>
          {!statusFilter && (
            <Link href="/admin/members?status=pending" className="admin-callout-link">
              <T k="admin.members.pendingOnly">대기 회원만 보기 →</T>
            </Link>
          )}
        </div>
      )}

      <MemberFilters
        counts={counts}
        total={total}
        status={params.status || ''}
        role={params.role || ''}
        search={params.search || ''}
      />

      <MemberTable
        members={members}
        students={students}
        canManageRoles={canManageRoles}
        pushDevices={pushDevices}
      />
    </div>
  );
}
