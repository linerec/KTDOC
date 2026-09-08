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
  getCorrectionNotes,
  getFormById,
  getOtherLatestResponsesForStudent,
  getResponseById,
  getResponseNotes,
  getSchemaVersion,
  getSelections,
  getSupersedingResponse,
} from '@/lib/d1';
import { getUserNamesByIds } from '@/lib/members';
import { allQuestions } from '@/lib/forms/schema';
import { responseStatusLabel } from '@/lib/forms/responseLabels';
import { PERIOD_LABEL_KO, tuitionForResponse } from '@/lib/forms/tuition';
import {
  describeDiff,
  describePlan,
  findSubjectQuestion,
  isPlanNoop,
  pickedKeys,
  selectableOptions,
} from '@/lib/forms/correction';
import { loadPlan } from '@/lib/forms/correctionRun';
import ResponseActions, { type PlannedCorrection } from '@/components/admin/forms/ResponseActions';
import type { Answers, CorrectionPayload, FormSchema } from '@/types/forms';

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
  searchParams: Promise<{ correct?: string }>;
}

function parsePayload(raw: string | null): CorrectionPayload | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CorrectionPayload;
  } catch {
    return null;
  }
}

export default async function AdminFormResponseDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'forms');

  const { id, rid } = await params;
  const { correct } = await searchParams;
  const formId = Number(id);
  const responseId = Number(rid);
  if (!Number.isInteger(formId) || !Number.isInteger(responseId)) notFound();

  const [form, response] = await Promise.all([getFormById(formId), getResponseById(responseId)]);
  if (!form || !response || response.form_id !== formId) notFound();

  const [selections, consents, notes, snapshot, corrections, superseding, loaded] = await Promise.all([
    getSelections(responseId),
    getConsents(responseId),
    getResponseNotes(responseId),
    getSchemaVersion(formId, response.form_schema_version),
    getCorrectionNotes(responseId),
    getSupersedingResponse(responseId),
    loadPlan(response).catch(() => null),
  ]);

  const schema = snapshot ?? (JSON.parse(form.schema_json) as FormSchema);
  const answers = JSON.parse(response.answers_json) as Answers;
  const questions = allQuestions(schema);

  const nameIds = [response.student_user_id, response.submitted_by_user_id].filter(
    (x): x is string => Boolean(x)
  );
  const names = nameIds.length ? await getUserNamesByIds(nameIds) : new Map<string, string>();
  const linkedName = response.student_user_id ? (names.get(response.student_user_id) ?? null) : null;
  const submitterName = response.submitted_by_user_id
    ? (names.get(response.submitted_by_user_id) ?? null)
    : null;

  // ── 정정 재료: 현재 문안의 과목 문항(정정은 현재 선택지로 고른다)
  const currentSchema = JSON.parse(form.schema_json) as FormSchema;
  const subjectQ = findSubjectQuestion(currentSchema);
  const currentKeys = subjectQ ? pickedKeys(subjectQ, answers) : [];
  const correction = subjectQ
    ? {
        questionLabel: subjectQ.label.ko,
        options: selectableOptions(subjectQ, currentKeys).map((o) => ({
          key: o.key,
          label: o.label.ko,
          programId: o.programId ?? null,
          retired: o.retired,
        })),
        currentKeys,
      }
    : null;

  // 적용된 정정(답변 카드의 '정정됨' 표시)과 예고된 정정(대기 카드)을 가른다
  const applied = corrections
    .map((n) => ({ note: n, payload: parsePayload(n.payload_json) }))
    .filter((x) => x.payload?.stage === 'applied');
  const planned: PlannedCorrection[] = corrections
    .map((n) => ({ note: n, payload: parsePayload(n.payload_json) }))
    .filter((x) => x.payload?.stage === 'planned')
    .map((x) => ({
      noteId: x.note.id,
      change: describeDiff(x.payload!.from, x.payload!.to),
      effective: x.payload!.effectiveDate ?? null,
      createdAt: x.note.created_at,
      author: x.note.author_name,
    }));
  const firstApplied = applied[0]?.payload ?? null;

  // 어긋남 — 배정 완료 상태인데 신청 과목과 명단이 다르면 경고
  const drift =
    loaded && loaded.hasStudent && response.status === 'enrolled' && !isPlanNoop(loaded.plan)
      ? describePlan(loaded.plan)
      : null;

  const others = response.student_user_id
    ? await getOtherLatestResponsesForStudent({
        formId,
        studentUserId: response.student_user_id,
        excludeResponseId: responseId,
      })
    : [];

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
          {/* 내 메일 앱으로 여는 길. 오른쪽 '메일 보내기' 카드와 달리 여기로 쓴 메일은
              학원 계정에서 나가지 않고 발송 내역에도 남지 않는다 — 그래서 이름을
              나눠 둔다(둘 다 '메일 보내기'면 기록이 남는 쪽을 고를 이유가 없다). */}
          {response.email && (
            <a href={`mailto:${response.email}`} className="admin-btn admin-btn-outline">
              내 메일 앱으로
            </a>
          )}
        </div>
      </div>

      {superseding && (
        <div className="admin-alert admin-alert-warning resp-banner">
          이 응답은 <Link href={`/admin/forms/${formId}/responses/${superseding.id}`}>#{superseding.id}</Link>
          ({superseding.submitted_at.slice(0, 10)}, {responseStatusLabel(superseding.status)})로 대체되었습니다.
          목록·명단에는 새 응답만 보입니다.
        </div>
      )}
      {response.supersedes_response_id && (
        <div className="admin-alert admin-alert-info resp-banner">
          재제출 — 이전 응답{' '}
          <Link href={`/admin/forms/${formId}/responses/${response.supersedes_response_id}`}>
            #{response.supersedes_response_id}
          </Link>
          을(를) 대체했습니다. 이전 응답이 만든 배정은 ‘수업에 넣기’를 누를 때 함께 정리됩니다.
        </div>
      )}
      {others.length > 0 && (
        <div className="admin-alert admin-alert-warning resp-banner">
          같은 원생의 다른 응답이 이 신청서에 따로 있습니다:{' '}
          {others.map((o, i) => (
            <span key={o.id}>
              {i > 0 && ', '}
              <Link href={`/admin/forms/${formId}/responses/${o.id}`}>#{o.id}</Link> (
              {responseStatusLabel(o.status)})
            </span>
          ))}
          . 어느 쪽이 맞는지 확인하고 한쪽을 취소해 주세요.
        </div>
      )}

      <div className="resp-detail">
        <div className="resp-detail-main">
          {/* ── 신청 과목 ── */}
          <section className="admin-card resp-panel">
            <h2 className="resp-panel-title">신청 과목</h2>
            {applied.length > 0 && (
              <ul className="resp-corrections">
                {applied.map(({ note, payload }) => (
                  <li key={note.id}>
                    <span className="admin-badge admin-badge-warning">정정</span>{' '}
                    {note.created_at.slice(0, 10)} {note.author_name ?? '운영진'} ·{' '}
                    {describeDiff(payload!.from, payload!.to)}
                  </li>
                ))}
              </ul>
            )}
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
              {applied.length > 0
                ? `신청하신 분이 본 문안(버전 ${response.form_schema_version}) 기준이며, 정정된 문항은 원래 값을 함께 보여 줍니다.`
                : `신청하신 분이 실제로 본 문안(버전 ${response.form_schema_version}) 그대로입니다.`}
            </p>
            <dl className="resp-answers">
              {questions
                .filter((q) => q.type !== 'info' && !q.sensitive && answers[q.key] !== undefined)
                .map((q) => (
                  <div key={q.key}>
                    <dt className="resp-answer-label">
                      {q.label.ko}
                      {firstApplied?.questionKey === q.key && (
                        <span className="admin-badge admin-badge-warning resp-answer-badge">정정됨</span>
                      )}
                    </dt>
                    <dd className="resp-answer-value">
                      {render(q.key)}
                      {firstApplied?.questionKey === q.key && (
                        <span className="resp-answer-original">
                          원래 답: {firstApplied.from.map((o) => o.label.trim()).join(' · ') || '(없음)'}
                        </span>
                      )}
                    </dd>
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
                        {responseStatusLabel(n.from_status)} →{' '}
                        <strong>{responseStatusLabel(n.to_status)}</strong>
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
            submitterName={submitterName}
            email={response.email}
            phone={response.phone}
            correction={correction}
            planned={planned}
            drift={drift}
            autoOpenCorrection={correct === '1'}
          />
        </aside>
      </div>
    </div>
  );
}
