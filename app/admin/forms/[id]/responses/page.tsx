/**
 * Admin 응답 목록
 *
 * 화면에 들어올 때 파생이 밀린 응답을 **조용히 재구축한다**. 운영자는 그런 일이
 * 있었는지도 모른다 — 그게 의도다(설계서 §4.1.2).
 *
 * 의료정보는 이 화면에 싣지 않는다. "있음" 배지까지가 목록의 몫이고,
 * 내용은 상세에서 펼쳐야 보이며 그때 열람 기록이 남는다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import T from '@/components/common/T';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import {
  adminResponseList,
  getFormById,
  getResponses,
  getSelections,
  rebuildDirtyForForm,
} from '@/lib/d1';
import ResponseFilters from '@/components/admin/forms/ResponseFilters';
import type { ResponseStatus } from '@/types/forms';

export const metadata: Metadata = {
  title: '신청 응답 | KTDOC Admin',
};

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<ResponseStatus, { ko: string; cls: string }> = {
  new: { ko: '신규', cls: 'admin-badge-warning' },
  reviewing: { ko: '확인 중', cls: 'admin-badge-muted' },
  needs_info: { ko: '추가 확인', cls: 'admin-badge-muted' },
  accepted: { ko: '승인', cls: 'admin-badge-success' },
  enrolled: { ko: '수업 배정됨', cls: 'admin-badge-success' },
  declined: { ko: '거절', cls: 'admin-badge-muted' },
  cancelled: { ko: '취소', cls: 'admin-badge-danger' },
};

const STATUSES = Object.keys(STATUS_LABEL) as ResponseStatus[];

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function AdminFormResponsesPage({ params, searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'forms');

  const { id } = await params;
  const formId = Number(id);
  if (!Number.isInteger(formId)) notFound();

  const form = await getFormById(formId);
  if (!form) notFound();

  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as ResponseStatus)
    ? (sp.status as ResponseStatus)
    : undefined;

  // 밀린 파생을 조용히 따라잡는다 — 명단이 비어 보이는 사고를 막는다.
  await rebuildDirtyForForm(formId);

  const view = adminResponseList({ formId, status, search: sp.q });
  const { rows, total } = await getResponses(view);

  // 선택 과목은 파생 테이블에서 — answers_json 을 목록에서 펴지 않는다.
  const selectionsByResponse = new Map<number, string[]>();
  await Promise.all(
    rows.map(async (r) => {
      const s = await getSelections(r.id);
      selectionsByResponse.set(
        r.id,
        s.map((x) => x.option_label_ko ?? x.option_key)
      );
    })
  );

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/forms">
              <T k="admin.nav.forms">신청서 관리</T>
            </Link>
            <span>/</span>
            <Link href={`/admin/forms/${formId}`}>{form.title_ko}</Link>
          </div>
          <h1 className="admin-title">신청 응답</h1>
          <p className="admin-subtitle">
            {form.title_ko} · 모두 {total}건
          </p>
        </div>
        <div className="admin-header-actions">
          <Link
            href={`/admin/forms/${formId}/roster`}
            className="admin-btn admin-btn-outline"
          >
            과목별 명단
          </Link>
          <a
            href={`/api/admin/forms/${formId}/export.csv`}
            className="admin-btn admin-btn-outline"
          >
            표로 내려받기
          </a>
          <Link
            href={`/admin/forms/${formId}/responses/new`}
            className="admin-btn admin-btn-primary"
          >
            + 대신 입력
          </Link>
        </div>
      </div>

      <ResponseFilters formId={formId} status={sp.status ?? ''} q={sp.q ?? ''} total={total} />

      {rows.length === 0 ? (
        <div className="admin-card admin-empty">
          <p>조건에 맞는 신청이 없습니다.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>학생</th>
                <th>신청 과목</th>
                <th>연락처</th>
                <th>상태</th>
                <th>접수</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = STATUS_LABEL[r.status];
                const picks = selectionsByResponse.get(r.id) ?? [];
                return (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/admin/forms/${formId}/responses/${r.id}`}
                        className="admin-link-strong"
                      >
                        {r.student_name}
                      </Link>
                      <div className="admin-cell-sub">
                        {r.student_grade ?? '학년 미기재'}
                        {r.has_medical === 1 && (
                          <span className="admin-badge admin-badge-warning resp-medical">
                            건강 특이사항 있음
                          </span>
                        )}
                        {r.source === 'staff' && (
                          <span className="admin-badge admin-badge-muted">대리 입력</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {picks.length > 0 ? (
                        <span className="resp-picks">{picks.join(' · ')}</span>
                      ) : (
                        <span className="admin-cell-sub">—</span>
                      )}
                    </td>
                    <td>
                      {r.phone && <a href={`tel:${r.phone}`}>{r.phone}</a>}
                      {r.email && (
                        <div className="admin-cell-sub">
                          <a href={`mailto:${r.email}`}>{r.email}</a>
                        </div>
                      )}
                      {!r.phone && !r.email && <span className="admin-cell-sub">—</span>}
                    </td>
                    <td>
                      <span className={`admin-badge ${s.cls}`}>{s.ko}</span>
                      {r.student_user_id == null && (
                        <div className="admin-cell-sub">회원 미연결</div>
                      )}
                    </td>
                    <td className="admin-cell-sub">{r.submitted_at?.slice(0, 10)}</td>
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
