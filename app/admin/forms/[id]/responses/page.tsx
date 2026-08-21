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
import ResponseRow from '@/components/admin/forms/ResponseRow';
import { allQuestions } from '@/lib/forms/schema';
import {
  REG_TYPE_LABEL,
  RESPONSE_STATUSES,
  RESPONSE_STATUS_BADGE,
  RESPONSE_STATUS_LABEL,
  regTypeOf,
} from '@/lib/forms/responseLabels';
import { PERIOD_LABEL_KO, periodOf, tuitionForResponse } from '@/lib/forms/tuition';
import type { Answers, FormSchema, ResponseStatus } from '@/types/forms';

export const metadata: Metadata = {
  title: '신청 응답 | KTDOC Admin',
};

export const dynamic = 'force-dynamic';

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
  const status = RESPONSE_STATUSES.includes(sp.status as ResponseStatus)
    ? (sp.status as ResponseStatus)
    : undefined;

  // 밀린 파생을 조용히 따라잡는다 — 명단이 비어 보이는 사고를 막는다.
  await rebuildDirtyForForm(formId);

  const view = adminResponseList({ formId, status, search: sp.q });
  const { rows, total } = await getResponses(view);

  // 선택 과목은 파생 테이블에서 — 라벨은 스냅샷이라 여기서 스키마를 읽지 않아도 된다.
  // 키는 학비표 조회에 쓴다(라벨은 매년 바뀌지만 키는 그대로다).
  const picksByResponse = new Map<number, { keys: string[]; labels: string[] }>();
  await Promise.all(
    rows.map(async (r) => {
      const s = await getSelections(r.id);
      picksByResponse.set(r.id, {
        keys: s.map((x) => x.option_key),
        labels: s.map((x) => x.option_label_ko ?? x.option_key),
      });
    })
  );

  // 학비표 조회 — **지금 문안**으로 본다. 상세는 그 응답이 본 버전 스냅샷을 쓰지만,
  // 목록에서 응답마다 스냅샷을 불러오면 조회가 배로 는다. 옛 선택지는 조회에서
  // 빠지고 "개별 확인"으로 표시되므로, 틀린 금액이 실릴 일은 없다.
  const schema = JSON.parse(form.schema_json) as FormSchema;
  const questions = allQuestions(schema);

  /** 한 건이 망가져도 목록 전체가 죽지 않게 한다. */
  function answersOf(json: string): Answers {
    try {
      return JSON.parse(json) as Answers;
    } catch {
      return {};
    }
  }

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
        <>
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
                const picks = picksByResponse.get(r.id) ?? { keys: [], labels: [] };
                const answers = answersOf(r.answers_json);
                const period = periodOf(questions, answers);
                const tuition = tuitionForResponse(questions, answers, picks.keys);
                const regType = regTypeOf(questions, answers);
                return (
                  <ResponseRow key={r.id} href={`/admin/forms/${formId}/responses/${r.id}`}>
                    <td>
                      <Link
                        href={`/admin/forms/${formId}/responses/${r.id}`}
                        className="admin-link-strong"
                      >
                        {r.student_name}
                      </Link>
                      <div className="admin-cell-sub resp-student-sub">
                        {/* 학년은 성인 수강생에게 없는 것이 정상이다 — '미기재'는 빠뜨렸다는 뜻이라 쓰지 않는다. */}
                        <span>{r.student_grade || '—'}</span>
                        {regType && (
                          <span className="admin-badge admin-badge-muted">
                            {REG_TYPE_LABEL[regType]}
                          </span>
                        )}
                        {r.has_medical === 1 && (
                          <span className="admin-badge admin-badge-warning">
                            건강 특이사항 있음
                          </span>
                        )}
                        {r.source === 'staff' && (
                          <span className="admin-badge admin-badge-muted">대리 입력</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {picks.labels.length > 0 ? (
                        <>
                          {/* 요약이 먼저 온다 — 인보이스를 쓰는 사람은 이 줄만 세로로 훑는다. */}
                          <div className="resp-pick-summary">
                            <strong>{picks.labels.length}과목</strong>
                            {period && <span> · {PERIOD_LABEL_KO[period]}</span>}
                            {tuition ? (
                              <span className="resp-pick-amount">
                                {' '}
                                · ${tuition.amount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="resp-pick-unknown"> · 개별 확인</span>
                            )}
                          </div>
                          <span className="resp-picks">{picks.labels.join(' · ')}</span>
                        </>
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
                      <span className={`admin-badge ${RESPONSE_STATUS_BADGE[r.status]}`}>
                        {RESPONSE_STATUS_LABEL[r.status]}
                      </span>
                      {r.student_user_id == null && (
                        <div
                          className="admin-cell-sub"
                          title="이 신청이 아직 사이트 회원 계정에 연결되지 않았습니다. 로그인하지 않고 내면 이렇게 됩니다. 상세 화면에서 회원을 연결해야 수업 명단에 넣을 수 있습니다."
                        >
                          회원 계정 미연결
                        </div>
                      )}
                    </td>
                    <td className="admin-cell-sub">{r.submitted_at?.slice(0, 10)}</td>
                  </ResponseRow>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* 툴팁만으로는 모바일에서 읽을 길이 없다 — 한 줄로 적어 둔다.
            상태 배지는 처리 단계이고, 신규 등록/재등록은 학생 칸의 배지다. */}
        {rows.some((r) => r.student_user_id == null) && (
          <p className="admin-field-help resp-legend">
            <strong>회원 계정 미연결</strong> — 신청은 정상 접수되었지만 사이트 회원 계정에
            이어지지 않은 상태입니다. 로그인하지 않고 신청하면 이렇게 됩니다. 신청 건을 열어
            회원을 연결해야 수업 명단에 넣을 수 있습니다.
          </p>
        )}
        </>
      )}
    </div>
  );
}
