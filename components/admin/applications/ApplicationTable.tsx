'use client';

/**
 * ApplicationTable
 * 관리자용 신청자 목록. 주 동작은 이메일 답장(mailto) / 전화(tel). 상태 변경은 보조.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApplicationWithProgram } from '@/types/programs';
import ApplicationStatusControl from './ApplicationStatusControl';

interface ApplicationTableProps {
  applications: ApplicationWithProgram[];
}

function formatDate(value: string): string {
  if (!value) return '-';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

export default function ApplicationTable({ applications }: ApplicationTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (app: ApplicationWithProgram) => {
    if (!confirm(`${app.applicant_name}님의 신청을 삭제하시겠습니까?`)) return;
    setDeletingId(app.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${app.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '삭제에 실패했습니다.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  if (applications.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>아직 신청이 없습니다.</p>
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
              <th style={{ width: '110px' }}>상태</th>
              <th style={{ width: '200px' }}>신청자</th>
              <th style={{ width: '160px' }}>프로그램</th>
              <th style={{ width: '210px' }}>연락처</th>
              <th style={{ width: '100px' }}>신청일</th>
              <th style={{ width: '190px' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => {
              const programLabel = app.program_title_ko || '(삭제된 프로그램)';
              const replySubject = encodeURIComponent(`Re: ${programLabel} 신청`);
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
                          {[app.guardian_name ? `보호자 ${app.guardian_name}` : null, app.participant_age ? `${app.participant_age}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{programLabel}</td>
                  <td>
                    <div className="admin-table-contact">
                      <a href={`mailto:${app.email}?subject=${replySubject}`} className="admin-table-link-inline">
                        {app.email}
                      </a>
                      {app.phone && (
                        <a href={`tel:${app.phone}`} className="admin-table-muted-link">
                          {app.phone}
                        </a>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(app.created_at)}</td>
                  <td>
                    <div className="admin-table-actions">
                      <a
                        href={`mailto:${app.email}?subject=${replySubject}`}
                        className="admin-btn admin-btn-sm"
                      >
                        이메일 답장
                      </a>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => handleDelete(app)}
                        disabled={deletingId === app.id}
                      >
                        {deletingId === app.id ? '...' : '삭제'}
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
