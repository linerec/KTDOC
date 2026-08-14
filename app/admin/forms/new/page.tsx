/**
 * Admin — 새 신청서 만들기
 *
 * 프리셋을 골라 시작한다. 원장은 빈 캔버스를 만나지 않는다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import T from '@/components/common/T';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import NewFormPanel from '@/components/admin/forms/NewFormPanel';

export const metadata: Metadata = {
  title: '새 신청서 | KTDOC Admin',
};

export default async function NewFormPage() {
  const session = await auth();
  await requireMenuAccess(session, 'forms');

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/forms">
              <T k="admin.nav.forms">신청서 관리</T>
            </Link>
          </div>
          <h1 className="admin-title">
            <T k="admin.forms.newTitle">새 신청서</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.forms.newSubtitle">
              어떤 신청서인지 고르면 문항이 이미 채워진 채로 시작합니다. 문구와 과목은 만든 뒤에
              고칠 수 있습니다.
            </T>
          </p>
        </div>
      </div>

      <NewFormPanel />
    </div>
  );
}
