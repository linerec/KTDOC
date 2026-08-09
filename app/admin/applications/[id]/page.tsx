/**
 * Admin Application Detail
 * 신청 한 건의 내용과 상태. 답장·전화 링크로 바로 연락한다.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getApplicationById } from '@/lib/d1';
import ApplicationDetailCard from '@/components/admin/applications/ApplicationDetailCard';
import T from '@/components/common/T';

export const metadata = {
  title: '신청 상세 | KTDOC Admin',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'applications');

  const { id } = await params;
  const appId = parseInt(id);
  if (isNaN(appId)) {
    notFound();
  }

  const app = await getApplicationById(appId);
  if (!app) {
    notFound();
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/applications">
              <T k="admin.nav.applications">신청 현황</T>
            </Link>
            <span>/</span>
            <span>{app.applicant_name}</span>
          </div>
          <h1 className="admin-title">
            <T k="admin.applications.detailTitle">신청 상세</T>
          </h1>
        </div>
      </div>

      <ApplicationDetailCard app={app} />
    </div>
  );
}
