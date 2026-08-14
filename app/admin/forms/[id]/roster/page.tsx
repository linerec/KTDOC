/**
 * Admin 과목별 명단 — 반편성을 하는 자리
 *
 * 정렬이 곧 배정 규칙이다: **1년 등록 우선 → 그다음 신청 순서.**
 * 삼고무·오고무는 보유 북 수량이 제한되어 1년 과정 학생에게 우선 배정되고
 * 잔여 자리는 선착순이라는 신청서 안내를 그대로 옮긴 것이다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getFormById, getRoster, getSelectionCounts, rebuildDirtyForForm, rosterView } from '@/lib/d1';
import { allQuestions } from '@/lib/forms/schema';
import type { RosterRow } from '@/lib/d1';
import type { FormSchema } from '@/types/forms';

export const metadata: Metadata = {
  title: '과목별 명단 | KTDOC Admin',
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const PERIOD_LABEL: Record<string, string> = { m3: '3개월', m6: '6개월', y1: '1년' };

export default async function AdminFormRosterPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'forms');

  const { id } = await params;
  const formId = Number(id);
  if (!Number.isInteger(formId)) notFound();

  const form = await getFormById(formId);
  if (!form) notFound();

  await rebuildDirtyForForm(formId);

  const schema = JSON.parse(form.schema_json) as FormSchema;
  const questions = allQuestions(schema);
  const classQuestion = questions.find((q) => q.selectionOf);
  const periodQuestion = questions.find((q) => q.key.includes('period') && q.type === 'single');
  const fullYearKey =
    periodQuestion?.options?.find((o) => o.key === 'y1' || o.label.ko.includes('1년'))?.key ?? 'y1';

  // 조건을 여기서 조립하지 않는다 — 어느 화면이 무엇을 보는가는 관점 함수가 정한다.
  const view = rosterView({
    formId,
    periodQuestionKey: periodQuestion?.key ?? 'q6_period',
    fullYearOptionKey: fullYearKey,
  });
  const [rows, counts] = await Promise.all([getRoster(view), getSelectionCounts(formId)]);

  // option_key 순서는 신청서에 적힌 순서를 따른다(SQL의 알파벳 순이 아니라).
  const optionOrder = (classQuestion?.options ?? []).map((o) => o.key);
  const grouped = new Map<string, RosterRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.option_key) ?? [];
    list.push(r);
    grouped.set(r.option_key, list);
  }

  const sections = optionOrder
    .map((key) => ({
      key,
      option: classQuestion?.options?.find((o) => o.key === key),
      rows: grouped.get(key) ?? [],
    }))
    .filter((s) => s.rows.length > 0 || !s.option?.retired);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/forms">신청서 관리</Link>
            <span>/</span>
            <Link href={`/admin/forms/${formId}/responses`}>신청 응답</Link>
          </div>
          <h1 className="admin-title">과목별 명단</h1>
          <p className="admin-subtitle">
            {form.title_ko} · 1년 등록 학생이 먼저, 그다음 신청 순서대로 정렬되어 있습니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <a href={`/api/admin/forms/${formId}/export.csv`} className="admin-btn admin-btn-outline">
            표로 내려받기
          </a>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="admin-card admin-empty">
          <p>아직 신청이 없습니다.</p>
        </div>
      ) : (
        <div className="roster">
          {sections.map((s) => {
            const count = counts[s.key] ?? 0;
            const capacity = s.option?.capacity;
            const over = capacity != null && count > capacity;
            return (
              <section key={s.key} className="admin-card roster-section">
                <div className="roster-head">
                  <h2 className="roster-title">{s.option?.label.ko ?? s.key}</h2>
                  <span className={`roster-count${over ? ' is-over' : ''}`}>
                    {capacity != null ? `${count} / ${capacity}` : `${count}명`}
                  </span>
                </div>

                {s.rows.length === 0 ? (
                  <p className="admin-field-help">아직 신청자가 없습니다.</p>
                ) : (
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th className="roster-no">#</th>
                          <th>학생</th>
                          <th>학년</th>
                          <th>등록 기간</th>
                          <th>연락처</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.rows.map((r, i) => (
                          <tr key={`${r.response_id}-${r.option_key}`}>
                            <td className="roster-no">{i + 1}</td>
                            <td>
                              <Link
                                href={`/admin/forms/${formId}/responses/${r.response_id}`}
                                className="admin-link-strong"
                              >
                                {r.student_name}
                              </Link>
                            </td>
                            <td className="admin-cell-sub">{r.student_grade ?? '—'}</td>
                            <td>
                              <span
                                className={`admin-badge ${r.period_key === fullYearKey ? 'admin-badge-success' : 'admin-badge-muted'}`}
                              >
                                {PERIOD_LABEL[r.period_key ?? ''] ?? '—'}
                              </span>
                            </td>
                            <td className="admin-cell-sub">
                              {r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
