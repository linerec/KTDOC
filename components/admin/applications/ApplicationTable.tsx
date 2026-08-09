'use client';

/**
 * ApplicationTable
 * 관리자용 신청자 목록. 주 동작은 이메일 답장(mailto) / 전화(tel). 상태 변경은 보조.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApplicationWithProgram } from '@/types/programs';
import ApplicationStatusControl from './ApplicationStatusControl';
import { useT } from '@/lib/i18n/useT';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatTimestampDate } from '@/lib/i18n/formatDate';
import { replySubject } from '@/lib/i18n/applicationLabels';

interface ApplicationTableProps {
  applications: ApplicationWithProgram[];
}

export default function ApplicationTable({ applications }: ApplicationTableProps) {
  const router = useRouter();
  const t = useT();
  const { locale } = useLanguage();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (app: ApplicationWithProgram) => {
    if (
      !confirm(
        t('admin.applications.deleteConfirm', '{name}님의 신청을 삭제하시겠습니까?', {
          name: app.applicant_name,
        })
      )
    )
      return;
    setDeletingId(app.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${app.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.deleteFailed', '삭제에 실패했습니다.'));
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.deleteFailed', '삭제에 실패했습니다.')
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (applications.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>{t('admin.applications.empty', '아직 신청이 없습니다.')}</p>
      </div>
    );
  }

  return (
    <>
      {error && <div className="admin-alert admin-alert-error">{error}</div>}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '110px' }}>{t('admin.members.colStatus', '상태')}</th>
              <th style={{ width: '200px' }}>{t('admin.applications.colApplicant', '신청자')}</th>
              <th style={{ width: '160px' }}>{t('admin.applications.colProgram', '프로그램')}</th>
              <th style={{ width: '210px' }}>{t('admin.applications.colContact', '연락처')}</th>
              <th style={{ width: '100px' }}>{t('admin.applications.colDate', '신청일')}</th>
              <th style={{ width: '190px' }}>{t('admin.common.colActions', '작업')}</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => {
              const programLabel =
                app.program_title_ko || t('admin.applications.deletedProgram', '(삭제된 프로그램)');
              const subject = replySubject(t, programLabel);
              return (
                <tr key={app.id} className={app.status === 'new' ? 'admin-table-row-new' : undefined}>
                  <td>
                    <ApplicationStatusControl id={app.id} status={app.status} />
                  </td>
                  <td>
                    <div className="admin-table-link">
                      <span className="admin-table-title">{app.applicant_name}</span>
                      {(app.guardian_name || app.participant_age) && (
                        <span className="admin-table-subtitle">
                          {[
                            app.guardian_name
                              ? t('admin.applications.guardianOf', '보호자 {name}', {
                                  name: app.guardian_name,
                                })
                              : null,
                            app.participant_age ? `${app.participant_age}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{programLabel}</td>
                  <td>
                    <div className="admin-table-contact">
                      <a
                        href={`mailto:${app.email}?subject=${subject}`}
                        className="admin-table-link-inline"
                      >
                        {app.email}
                      </a>
                      {app.phone && (
                        <a href={`tel:${app.phone}`} className="admin-table-muted-link">
                          {app.phone}
                        </a>
                      )}
                    </div>
                  </td>
                  <td>{formatTimestampDate(app.created_at, locale)}</td>
                  <td>
                    <div className="admin-table-actions">
                      <a
                        href={`mailto:${app.email}?subject=${subject}`}
                        className="admin-btn admin-btn-sm"
                      >
                        {t('admin.applications.reply', '이메일 답장')}
                      </a>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => handleDelete(app)}
                        disabled={deletingId === app.id}
                      >
                        {deletingId === app.id ? '...' : t('admin.common.delete', '삭제')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
