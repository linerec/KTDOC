/**
 * Admin Application Detail
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getApplicationById } from '@/lib/d1';
import ApplicationStatusControl from '@/components/admin/applications/ApplicationStatusControl';

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

  const programLabel = app.program_title_ko || '(삭제된 프로그램)';
  const replySubject = encodeURIComponent(`Re: ${programLabel} 신청`);

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: '프로그램', value: programLabel },
    { label: '신청자', value: app.applicant_name },
    { label: '보호자', value: app.guardian_name || '-' },
    {
      label: '이메일',
      value: (
        <a href={`mailto:${app.email}?subject=${replySubject}`} className="admin-table-link-inline">
          {app.email}
        </a>
      ),
    },
    {
      label: '전화번호',
      value: app.phone ? (
        <a href={`tel:${app.phone}`} className="admin-table-link-inline">
          {app.phone}
        </a>
      ) : (
        '-'
      ),
    },
    { label: '참가자 나이', value: app.participant_age || '-' },
    { label: '요청 사항', value: app.message || '-' },
  ];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/applications">신청 현황</Link>
            <span>/</span>
            <span>{app.applicant_name}</span>
          </div>
          <h1 className="admin-title">신청 상세</h1>
        </div>
        <div className="admin-header-actions">
          <a
            href={`mailto:${app.email}?subject=${replySubject}`}
            className="admin-btn admin-btn-primary"
          >
            이메일 답장
          </a>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-detail-row admin-detail-status-row">
          <span className="admin-detail-label">상태</span>
          <ApplicationStatusControl id={app.id} status={app.status} />
        </div>
        {rows.map((row) => (
          <div className="admin-detail-row" key={row.label}>
            <span className="admin-detail-label">{row.label}</span>
            <span className="admin-detail-value">{row.value}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
