'use client';

/**
 * 신청 상세 한 장 — 상태 + 신청서 내용
 *
 * 답장 메일 제목(mailto의 subject)을 목록과 같은 규칙으로 만들어야 해서
 * 클라이언트에서 조립한다(replySubject 공유).
 */

import type { ApplicationWithProgram } from '@/types/programs';
import { useT } from '@/lib/i18n/useT';
import { replySubject } from '@/lib/i18n/applicationLabels';
import ApplicationStatusControl from './ApplicationStatusControl';

export default function ApplicationDetailCard({ app }: { app: ApplicationWithProgram }) {
  const t = useT();

  const programLabel =
    app.program_title_ko || t('admin.applications.deletedProgram', '(삭제된 프로그램)');
  const subject = replySubject(t, programLabel);

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: t('admin.applications.colProgram', '프로그램'), value: programLabel },
    { label: t('admin.applications.colApplicant', '신청자'), value: app.applicant_name },
    { label: t('admin.applications.guardian', '보호자'), value: app.guardian_name || '-' },
    {
      label: t('admin.members.colEmail', '이메일'),
      value: (
        <a href={`mailto:${app.email}?subject=${subject}`} className="admin-table-link-inline">
          {app.email}
        </a>
      ),
    },
    {
      label: t('admin.applications.phone', '전화번호'),
      value: app.phone ? (
        <a href={`tel:${app.phone}`} className="admin-table-link-inline">
          {app.phone}
        </a>
      ) : (
        '-'
      ),
    },
    { label: t('admin.applications.age', '참가자 나이'), value: app.participant_age || '-' },
    { label: t('admin.applications.message', '요청 사항'), value: app.message || '-' },
  ];

  return (
    <>
      <div className="admin-header-actions">
        <a href={`mailto:${app.email}?subject=${subject}`} className="admin-btn admin-btn-primary">
          {t('admin.applications.reply', '이메일 답장')}
        </a>
      </div>

      <section className="admin-card">
        <div className="admin-detail-row admin-detail-status-row">
          <span className="admin-detail-label">{t('admin.members.colStatus', '상태')}</span>
          <ApplicationStatusControl id={app.id} status={app.status} />
        </div>
        {rows.map((row) => (
          <div className="admin-detail-row" key={row.label}>
            <span className="admin-detail-label">{row.label}</span>
            <span className="admin-detail-value">{row.value}</span>
          </div>
        ))}
      </section>
    </>
  );
}
