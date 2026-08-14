/**
 * Admin 신청서 목록
 *
 * 구글폼으로 하던 일이 여기로 온다 — 질문지를 만들고, 링크·QR로 뿌리고,
 * 응답을 받아 수강 배정까지 잇는다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import T from '@/components/common/T';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getForms, getResponseCountsByForm } from '@/lib/d1';
import { PROVISIONAL_NOTES } from '@/lib/forms/provisionalNotes';
import type { FormStatus } from '@/types/forms';

export const metadata: Metadata = {
  title: '신청서 관리 | KTDOC Admin',
};

const STATUS_LABEL: Record<FormStatus, { ko: string; cls: string }> = {
  draft: { ko: '초안', cls: 'admin-badge-muted' },
  open: { ko: '접수 중', cls: 'admin-badge-success' },
  closed: { ko: '마감', cls: 'admin-badge-warning' },
  archived: { ko: '보관', cls: 'admin-badge-muted' },
};

export default async function AdminFormsPage() {
  const session = await auth();
  await requireMenuAccess(session, 'forms');

  const [forms, counts] = await Promise.all([getForms(), getResponseCountsByForm()]);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <h1 className="admin-title">
            <T k="admin.nav.forms">신청서 관리</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.forms.subtitle">
              수강 신청서·특강 신청서를 만들어 링크와 QR로 공유하고, 들어온 응답을 확인합니다.
            </T>
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/forms/new" className="admin-btn admin-btn-primary">
            <T k="admin.forms.new">+ 새 신청서</T>
          </Link>
        </div>
      </div>

      {PROVISIONAL_NOTES.length > 0 && (
        <div className="admin-callout">
          <strong>
            <T k="admin.forms.provisionalTitle">원장님 확인이 필요한 항목이 있습니다</T>
          </strong>{' '}
          <T k="admin.forms.provisionalBody">
            2026–2027 신청서를 만들면서 확정하지 못한 판단이 남아 있습니다. 신청서를 게시하기 전에
            확인해 주세요 — 게시한 뒤에는 과목 선택지를 나누거나 지울 수 없습니다.
          </T>
          <ul className="admin-callout-list">
            {PROVISIONAL_NOTES.map((n) => (
              <li key={n.id}>{n.question}</li>
            ))}
          </ul>
        </div>
      )}

      {forms.length === 0 ? (
        <div className="admin-card admin-empty">
          <p>
            <T k="admin.forms.empty">
              아직 만든 신청서가 없습니다. ‘새 신청서’로 시작해 보세요.
            </T>
          </p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  <T k="admin.forms.colTitle">신청서</T>
                </th>
                <th>
                  <T k="admin.forms.colStatus">상태</T>
                </th>
                <th>
                  <T k="admin.forms.colResponses">응답</T>
                </th>
                <th>
                  <T k="admin.forms.colAddress">공개 주소</T>
                </th>
                <th aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => {
                const status = STATUS_LABEL[f.status];
                const count = counts[f.id] ?? 0;
                return (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/admin/forms/${f.id}`} className="admin-link-strong">
                        {f.title_ko}
                      </Link>
                      {f.season && <div className="admin-cell-sub">{f.season}</div>}
                    </td>
                    <td>
                      <span className={`admin-badge ${status.cls}`}>{status.ko}</span>
                      {f.locked_at && (
                        <div className="admin-cell-sub">
                          <T k="admin.forms.locked">구조 잠김 · 문구만 수정 가능</T>
                        </div>
                      )}
                    </td>
                    <td>
                      {count > 0 ? (
                        <Link href={`/admin/forms/${f.id}/responses`}>{count}건</Link>
                      ) : (
                        <span className="admin-cell-sub">0건</span>
                      )}
                    </td>
                    <td>
                      {f.status === 'open' ? (
                        <a href={`/f/${f.slug}`} target="_blank" rel="noreferrer">
                          /f/{f.slug}
                        </a>
                      ) : (
                        <span className="admin-cell-sub">/f/{f.slug}</span>
                      )}
                    </td>
                    <td className="admin-cell-actions">
                      <Link href={`/admin/forms/${f.id}`} className="admin-btn admin-btn-sm admin-btn-outline">
                        <T k="admin.forms.edit">편집</T>
                      </Link>
                      <Link
                        href={`/admin/forms/${f.id}/responses`}
                        className="admin-btn admin-btn-sm admin-btn-outline"
                      >
                        <T k="admin.forms.responses">응답 보기</T>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
