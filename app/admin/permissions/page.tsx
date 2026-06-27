/**
 * Admin Permissions
 * 메뉴 권한 관리 — 메뉴 × 역할 매트릭스(관리자 전용).
 * 어떤 역할이 어떤 메뉴를 볼/접근할 수 있는지 여기서 한눈에 설정한다.
 */

import Link from 'next/link';
import { auth } from '@/auth';
import {
  getPermMatrix,
  buildToolMatrix,
  listOrphanKeys,
  requireMenuAccess,
} from '@/lib/admin/permissions';
import { MEMBER_ROLES, MEMBER_ROLE_LABELS } from '@/types/members';
import PermissionMatrix from '@/components/admin/permissions/PermissionMatrix';

export const metadata = {
  title: '권한 관리 | KTDOC Admin',
};

export default async function AdminPermissionsPage() {
  const session = await auth();
  // settings.permissions = requireRole 'admin' → 관리자만 통과
  await requireMenuAccess(session, 'settings.permissions');

  const matrix = await getPermMatrix();
  const rows = buildToolMatrix(matrix);
  const orphans = await listOrphanKeys();

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>권한 관리</span>
          </div>
          <h1 className="admin-title">권한 관리</h1>
          <p className="admin-subtitle">
            각 메뉴를 어떤 역할이 보고 접근할 수 있는지 설정합니다. 관리자는 항상 모든 메뉴에 접근할 수 있습니다.
          </p>
        </div>
      </div>

      <PermissionMatrix
        rows={rows}
        orphans={orphans}
        roles={MEMBER_ROLES}
        roleLabels={MEMBER_ROLE_LABELS}
      />
    </div>
  );
}
