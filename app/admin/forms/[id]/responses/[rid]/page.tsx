/**
 * Admin 응답 상세
 *
 * 답변을 **그 응답이 본 문안 버전으로 재현한다.** 지금 스키마로 그리면, 문구를
 * 고친 뒤에는 신청자가 실제로 읽은 것과 다른 화면을 보게 된다. 동의 증빙을
 * 다루는 화면에서 그건 치명적이다.
 *
 * 의료정보는 여기서도 기본으로 감춰져 있다 — 펼치는 순간 열람 기록이 남는다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import {
  getConsents,
  getFormById,
  getResponseById,
  getResponseNotes,
  getSchemaVersion,
  getSelections,
} from '@/lib/d1';
import { getUserNamesByIds } from '@/lib/members';
import { allQuestions } from '@/lib/forms/schema';
import { PERIOD_LABEL_KO, tuitionForResponse } from '@/lib/forms/tuition';
import ResponseActions from '@/components/admin/forms/ResponseActions';
import type { Answers, FormSchema } from '@/types/forms';

export const metadata: Metadata = {
  title: '신청 상세 | KTDOC Admin',
};

export const dynamic = 'force-dynamic';

const CONSENT_LABEL: Record<string, string> = {
  parade: '코리안 퍼레이드 참가',
  prop_fee: '칼춤 소품비',
  refund_policy: '환불 · 보강 정책',
  media_release: '미디어 촬영 · 활용',
  final: '최종 확인',
};

interface PageProps {
  params: Promise<{ id: string; rid: string }>;
}

export default async function AdminFormResponseDetailPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'forms');

  const { id, rid } = await params;
  const formId = Number(id);
  const responseId = Number(rid);
  if (!Number.isInteger(formId) || !Number.isInteger(responseId)) notFound();

  const [form, response] = await Promise.all([getFormById(formId), getResponseById(responseId)]);
  if (!form || !response || response.form_id !== formId) notFound();

  const [selections, consents, notes, snapshot] = await Promise.all([
    getSelections(responseId),
    getConsents(responseId),
    getResponseNotes(responseId),
    getSchemaVersion(formId, response.form_schema_version),
  ]);

  const schema = snapshot ?? (JSON.parse(form.schema_json) as FormSchema);
  const answers = JSON.parse(response.answers_json) as Answers;
  const questions = allQuestions(schema);

  const linkedName = response.student_user_id
    ? ((await getUserNamesByIds([response.student_user_id])).get(response.student_user_id) ?? null)
    : null;

  // 학비표 조회 보조 — 운영자 화면 전용. 신청자에게는 절대 보이지 않는다.
  // 조립은 lib/forms/tuition.ts 한 곳에서만 한다(목록과 같은 답을 내야 한다).
  // 기간은 아래 '답변' 섹션이 그대로 보여 주므로 여기서 따로 읽지 않는다.
  const tuition = tuitionForResponse(
    questions,
    answers,
    selections.map((s) => s.option_key)
  );

  /** 답 하나를 사람이 읽는 값으로. 민감 문항은 여기서 그리지 않는다. */
  function render(key: string): string {
    const q = questions.find((x) => x.key === key);
    const v = answers[key];
    if (v == null || v === '') return '—';
    if (typeof v === 'boolean') return v ? '동의' : '동의하지 않음';
    const labelOf = (k: string) => q?.options?.find((o) => o.key === k)?.label.ko ?? k;
    if (Array.isArray(v)) return v.map(labelOf).join(' · ');
    return q?.options?.length ? labelOf(v) : v;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/forms">신청서 관리</Link>
            <span>/</span>
            <Link href={`/admin/forms/${formId}/responses`}>신청 응답</Link>
          </div>
          <h1 className="admin-title">{response.student_name}</h1>
          <p className="admin-subtitle">
            접수번호 {String(response.id).padStart(4, '0')} · {response.submitted_at?.slice(0, 16)}
            {response.source === 'staff' && ' · 대리 입력'}
          </p>
        </div>
        <div className="admin-header-actions">
          {response.phone && (
            <a href={`tel:${response.phone}`} className="admin-btn admin-btn-outline">
              전화 {response.phone}
            </a>
          )}
          {response.email && (
            <a href={`mailto:${response.email}`} className="admin-btn admin-btn-outline">
              메일 보내기
            </a>
          )}
        </div>
      </div>

      <div className="resp-detail">
        <div className="resp-detail-main">
          {/* ── 신청 과목 ── */}
          <section className="admin-card resp-panel">
            <h2 className="resp-panel-title">신청 과목</h2>
            {selections.length === 0 ? (
              <p className="admin-field-help">선택한 과목이 없습니다.</p>
            ) : (
              <ul className="resp-pick-list">
                {selections.map((s) => (
                  <li key={s.id}>
                    <span>{s.option_label_ko ?? s.option_key}</span>
                    {s.program_id == null && (
                      <span className="admin-badge admin-badge-warning">수업 미연결</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {tuition ? (
              <p className="resp-tuition">
                학비표 참고 — <strong>{tuition.label}</strong> ·{' '}
                {PERIOD_LABEL_KO[tuition.period]}{' '}
                <strong>${tuition.amount.toLocaleString()}</strong>
                <span className="admin-cell-sub">
                  신청하신 분께는 보이지 않습니다. 최종 금액은 확인 후 개별 안내합니다.
                </span>
              </p>
            ) : (
              selections.length > 0 && (
                <p className="resp-tuition resp-tuition-none">
                  학비표에 없는 조합입니다 — 개별 확인이 필요합니다.
                </p>
              )
            )}
          </section>

          {/* ── 답변 ── */}
          <section className="admin-card resp-panel">
            <h2 className="resp-panel-title">답변</h2>
            <p className="admin-field-help">
              신청하신 분이 실제로 본 문안(버전 {response.form_schema_version}) 그대로입니다.
            </p>
            <dl className="resp-answers">
              {questions
                .filter((q) => q.type !== 'info' && !q.sensitive && answers[q.key] !== undefined)
                .map((q) => (
                  <div key={q.key}>
                    <dt className="resp-answer-label">{q.label.ko}</dt>
                    <dd className="resp-answer-value">{render(q.key)}</dd>
                  </div>
                ))}
              {response.has_medical === 1 && (
                <div>
                  <dt className="resp-answer-label">건강 및 특이사항</dt>
                  <dd className="resp-answer-value resp-answer-hidden">
                    내용이 있습니다 — 오른쪽에서 열어 보세요(열람 기록이 남습니다)
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* ── 동의 증빙 ── */}
          <section className="admin-card resp-panel">
            <h2 className="resp-panel-title">동의 증빙</h2>
            {consents.length === 0 ? (
              <p className="admin-field-help">기록된 동의가 없습니다.</p>
            ) : (
              <table className="admin-table resp-consents">
                <thead>
                  <tr>
                    <th>항목</th>
                    <th>답</th>
                    <th>문안 버전</th>
                    <th>시각</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.map((c) => (
                    <tr key={c.id}>
                      <td>{CONSENT_LABEL[c.consent_key] ?? c.consent_key}</td>
                      <td>
                        <span
                          className={`admin-badge ${c.agreed === 1 ? 'admin-badge-success' : 'admin-badge-danger'}`}
                        >
                          {c.agreed === 1 ? '동의' : '동의하지 않음'}
                        </span>
                      </td>
                      <td className="admin-cell-sub">v{c.policy_version}</td>
                      <td className="admin-cell-sub">{c.agreed_at?.slice(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ── 처리 이력 ── */}
          <section className="admin-card resp-panel">
            <h2 className="resp-panel-title">처리 이력</h2>
            {notes.length === 0 ? (
              <p className="admin-field-help">아직 기록이 없습니다.</p>
            ) : (
              <ol className="resp-history">
                {notes.map((n) => (
                  <li key={n.id}>
                    <div className="resp-history-head">
                      <span>{n.author_name ?? '시스템'}</span>
                      <span className="admin-cell-sub">{n.created_at?.slice(0, 16)}</span>
                    </div>
                    {n.from_status && n.to_status && (
                      <p className="resp-history-move">
                        {n.from_status} → <strong>{n.to_status}</strong>
                      </p>
                    )}
                    {n.body && <p className="resp-history-body">{n.body}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="resp-detail-side">
          <ResponseActions
            formId={formId}
            responseId={responseId}
            status={response.status}
            hasMedical={response.has_medical === 1}
            linkedUserId={response.student_user_id}
            linkedUserName={linkedName}
            studentName={response.student_name}
            email={response.email}
          />
        </aside>
      </div>
    </div>
  );
}
