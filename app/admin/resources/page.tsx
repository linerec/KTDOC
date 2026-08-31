/**
 * Admin — 공연 자료함 목록
 *
 * 운영진이 음원을 미리 올려 두고, 현장에서는 번호 하나(ktdoc.org/473128)로 연다.
 * 저작권 자료를 담는 자리라 admin 전용으로 fail-closed.
 */

import Link from 'next/link';
import T from '@/components/common/T';
import VaultList from '@/components/admin/resources/VaultList';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { listVaults } from '@/lib/d1/resources';

export const metadata = {
  title: '공연 자료함 | KTDOC Admin',
};

export default async function AdminResourcesPage() {
  const session = await auth();
  await requireMenuAccess(session, 'resources');

  const vaults = await listVaults();

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
              <T k="admin.resources.crumb">공연 자료함</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.resources.crumb">공연 자료함</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.resources.subtitle">
              공연에서 쓸 음원과 자료를 미리 올려 둡니다. 현장에서는 번호 하나와 비밀번호로 열어
              바로 재생하거나 내려받을 수 있습니다.
            </T>
          </p>
        </div>
      </div>

      <VaultList initialVaults={vaults} />
    </div>
  );
}
