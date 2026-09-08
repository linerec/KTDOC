/**
 * lib/forms/correctionRun.ts — 정정의 실행 (서버 전용)
 *
 * 판단은 correction.ts(순수)에 있고, 여기는 그 판단을 D1·메일·알림함에 옮기는
 * 손이다. 네 자리가 이 손을 쓴다:
 *   - 신청 화면 '수업에 넣기'(promote)     → reconcileEnrollments
 *   - 응답 상세 '과목 정정'(correct)       → applySubjectChange (+ planSubjectChange 예고)
 *   - 어긋남 복구 '배정 맞추기'(reconcile) → reconcileEnrollments
 *   - '취소'로 내릴 때 배정 회수(PATCH)    → reconcileEnrollments(빈 과목)
 *
 * D1에는 트랜잭션이 없다. 그래서 순서가 곧 안전장치다:
 *   답 갱신 → 배정 → 이력 → 안내. 배정에서 멈추면 답은 이미 바뀌어 있고 상세 화면이
 *   "신청 과목과 배정이 다릅니다"를 띄운다 — 같은 계획을 다시 돌리면(멱등) 이어진다.
 *   이력·안내에서 멈추면 결과에 단계명을 담아 돌려주고, 화면이 그대로 말한다.
 */

import 'server-only';
import { getCalendarConfig } from '@/lib/calendar';
import { dayInTimeZone } from '@/lib/siteDay';
import {
  addResponseNote,
  createEnrollment,
  deleteEnrollment,
  getEnrollmentRowsForUser,
  getEnrollmentsBySourceResponses,
  getFormById,
  getProgramById,
  getResponseChainIds,
  getResponseNoteById,
  getSelections,
  updateEnrollment,
  updateNotePayload,
  updateResponseAnswers,
} from '@/lib/d1';
import { getMemberById } from '@/lib/members';
import { notifyEvent, type NotifyResult } from '@/lib/mail/notify';
import { notifyFamilyOfClassChange } from '@/lib/push/system';
import {
  applySubjectCorrection,
  describeDiff,
  describePlan,
  findSubjectQuestion,
  isPlanNoop,
  optionRefs,
  pickedKeys,
  planEffects,
  planEnrollmentChanges,
  planForNotice,
  type CorrectionError,
  type EnrollmentPlan,
  type PlanEnrollment,
  type PlanProgram,
} from './correction';
import type {
  Answers,
  CorrectionOptionRef,
  CorrectionPayload,
  FormResponseRow,
  FormSchema,
} from '@/types/forms';

export interface RunActor {
  id: string | null;
  name: string | null;
}

export interface LoadedPlan {
  plan: EnrollmentPlan;
  chainIds: number[];
  /** 배정 대상 회원이 없으면(미연결) 계획은 비어 있고 이 값이 false */
  hasStudent: boolean;
}

/** 학원 시간대의 오늘 — "시작 전이면 삭제, 뒤면 취소"의 기준. */
async function academyToday(): Promise<string> {
  const cfg = await getCalendarConfig();
  return dayInTimeZone(new Date(), cfg.timezone);
}

/**
 * 응답의 현재 신청 과목과 배정을 비교한 계획. 상세 화면(어긋남 경고)·모달 미리보기·
 * 실제 실행이 전부 이것으로 시작한다.
 *
 * `selectionsOverride` 는 "이 과목으로 바꾸면 어떻게 되나"를 미리 보는 용도다.
 */
export async function loadPlan(
  response: FormResponseRow,
  selectionsOverride?: Array<{ option_key: string; option_label_ko: string | null; program_id: number | null }>
): Promise<LoadedPlan> {
  const chainIds = await getResponseChainIds(response.id);
  const student = response.student_user_id;
  if (!student) {
    return {
      plan: { add: [], revive: [], remove: [], keep: [], unlinked: [], skippedCancelled: [] },
      chainIds,
      hasStudent: false,
    };
  }

  const [selections, mine, chain, today] = await Promise.all([
    selectionsOverride ? Promise.resolve(selectionsOverride) : getSelections(response.id),
    getEnrollmentRowsForUser(student),
    getEnrollmentsBySourceResponses(chainIds),
    academyToday(),
  ]);

  const byId = new Map<number, PlanEnrollment>();
  for (const e of [...mine, ...chain]) byId.set(e.id, e);
  const enrollments = Array.from(byId.values());

  const programIds = new Set<number>();
  for (const s of selections) if (s.program_id != null) programIds.add(s.program_id);
  for (const e of enrollments) programIds.add(e.program_id);
  const programs = new Map<number, PlanProgram>();
  await Promise.all(
    Array.from(programIds).map(async (pid) => {
      const p = await getProgramById(pid).catch(() => null);
      if (p) programs.set(pid, { id: pid, title_ko: p.title_ko, term_start_date: p.term_start_date });
    })
  );

  const plan = planEnrollmentChanges({
    studentUserId: student,
    selections,
    chainIds,
    enrollments,
    programs,
    today,
  });
  return { plan, chainIds, hasStudent: true };
}

/** 계획을 D1에 옮긴다. 멱등 — 같은 계획을 두 번 돌려도 결과가 같다. */
export async function executePlan(
  plan: EnrollmentPlan,
  response: FormResponseRow,
  actor: RunActor
): Promise<void> {
  const student = response.student_user_id;
  if (!student) return;
  const stamp = new Date().toISOString().slice(0, 10);

  for (const r of plan.remove) {
    if (r.mode === 'delete') {
      await deleteEnrollment(r.enrollmentId);
    } else {
      await updateEnrollment(r.enrollmentId, {
        status: 'cancelled',
        note: `신청 정정 #${response.id} (${stamp})`,
      });
    }
  }
  for (const a of [...plan.add, ...plan.revive]) {
    await createEnrollment(a.programId, {
      user_id: student,
      status: 'active',
      note: `신청서 접수 #${response.id}`,
      enrolled_by: actor.id,
      source_response_id: response.id,
    });
  }
}

export interface NoticeInput {
  response: FormResponseRow;
  studentName: string;
  plan: EnrollmentPlan;
  stage: 'planned' | 'applied';
  effective?: string | null;
  actor: RunActor;
}

/**
 * 수업 변경 안내 — 메일(원생 + 보호자 자동 + 신청서에 적힌 주소) + 앱 알림함.
 * 실패해도 던지지 않는다. 결과는 돌려주고 호출부가 그대로 화면에 말한다.
 */
export async function sendClassChangeNotice(input: NoticeInput): Promise<NotifyResult> {
  const notice = planForNotice(input.plan);
  const data = {
    name: input.studentName,
    left: notice.left.join('\n'),
    joined: notice.joined.join('\n'),
    effective: input.effective ?? '',
    stage: input.stage,
    by: input.actor.name ?? '운영진',
    url: '/admin/my-classes',
  };
  const result = await notifyEvent('enrollment.changed', {
    userIds: input.response.student_user_id ? [input.response.student_user_id] : [],
    directEmails: input.response.email ? [input.response.email] : [],
    data,
  });
  if (input.response.student_user_id && input.actor.id) {
    await notifyFamilyOfClassChange({
      senderId: input.actor.id,
      studentUserId: input.response.student_user_id,
      studentName: input.studentName,
      left: notice.left,
      joined: notice.joined,
      stage: input.stage,
      effective: input.effective ?? null,
    }).catch((e) => console.error('수업 변경 앱 알림 실패:', e));
  }
  return result;
}

/** 배정 전 정정 확인 — 신청 과목이 바뀌었다는 것만. */
async function sendSubjectChangeNotice(input: {
  response: FormResponseRow;
  studentName: string;
  change: string;
  actor: RunActor;
}): Promise<NotifyResult> {
  return notifyEvent('form.corrected', {
    userIds: input.response.student_user_id ? [input.response.student_user_id] : [],
    directEmails: input.response.email ? [input.response.email] : [],
    data: {
      name: input.studentName,
      title: input.response.form_title_ko ?? '수강 신청서',
      change: input.change,
      by: input.actor.name ?? '운영진',
      url: '/admin/my-applications',
    },
  });
}

function mailSummary(r: NotifyResult | null): string {
  if (!r) return '안내는 보내지 않았습니다.';
  if (r.sent === 0 && r.failed === 0) {
    if (r.quotaBlocked > 0)
      return `안내 메일 ${r.quotaBlocked}통이 발송 한도에 걸려 보류됐습니다 — 전화로 알려 주세요.`;
    return '안내 메일이 나가지 않았습니다(수신처 없음 또는 스위치 꺼짐).';
  }
  return (
    `안내 메일 ${r.sent}통 발송` +
    (r.failed > 0 ? `, ${r.failed}통 실패` : '') +
    (r.quotaBlocked > 0 ? `, ${r.quotaBlocked}통 한도 보류` : '') +
    '.'
  );
}

async function recordMail(responseId: number, label: string, r: NotifyResult, actor: RunActor) {
  const to = r.outcomes.filter((o) => o.status === 'sent').map((o) => o.to);
  await addResponseNote({
    responseId,
    kind: 'mail',
    body:
      `${label} — 받는 사람: ${to.length ? to.join(', ') : '(없음)'}` +
      (r.failed > 0 ? ` (실패 ${r.failed}건)` : '') +
      (r.quotaBlocked > 0 ? ` (발송 한도로 보류 ${r.quotaBlocked}건)` : ''),
    authorId: actor.id,
    authorName: actor.name,
    system: true,
  }).catch((e) => console.error('안내 이력 기록 실패:', e));
}

// ─────────────────────────────────────────────────────────────────
// 배정 맞추기 — '수업에 넣기'·어긋남 복구·취소 회수가 같은 함수
// ─────────────────────────────────────────────────────────────────

export interface ReconcileResult {
  plan: EnrollmentPlan;
  noop: boolean;
  /** 실제로 바뀐 것이 있고 배정 이력이 있는 줄기면 '변경', 첫 배정이면 '등록' 안내가 나간다 */
  noticeKind: 'created' | 'changed' | null;
  mail: NotifyResult | null;
  summary: string;
}

export async function reconcileEnrollments(input: {
  response: FormResponseRow;
  actor: RunActor;
  /** 빈 배열을 넘기면 "이 줄기의 배정을 전부 거둔다"(취소). */
  selectionsOverride?: Array<{ option_key: string; option_label_ko: string | null; program_id: number | null }>;
  notify: boolean;
  /** 이력에 남길 이유(취소·복구 등). 정정은 자기 이력을 따로 쓴다. */
  noteBody?: string | null;
  /** true 면 이력을 남기지 않는다(호출부가 정정 이력에 합쳐 쓴다) */
  silentNote?: boolean;
}): Promise<ReconcileResult> {
  const { response, actor } = input;
  const loaded = await loadPlan(response, input.selectionsOverride);
  const plan = loaded.plan;
  if (!loaded.hasStudent || isPlanNoop(plan)) {
    return { plan, noop: true, noticeKind: null, mail: null, summary: '배정은 그대로입니다.' };
  }

  await executePlan(plan, response, actor);

  // 첫 배정(빠진 것 없이 더하기만)이면 '등록' 안내, 아니면 '변경' 안내
  const firstTime = plan.remove.length === 0 && plan.revive.length === 0;
  let mail: NotifyResult | null = null;
  let noticeKind: ReconcileResult['noticeKind'] = null;
  const member = response.student_user_id ? await getMemberById(response.student_user_id) : null;
  const studentName = member?.name ?? response.student_name;

  if (input.notify) {
    if (firstTime) {
      noticeKind = 'created';
      mail = await notifyEvent('enrollment.created', {
        userIds: response.student_user_id ? [response.student_user_id] : [],
        data: { name: studentName, title: plan.add.map((a) => a.title).join(', '), schedule: '' },
      });
      await recordMail(response.id, '수업 등록 안내', mail, actor);
    } else {
      noticeKind = 'changed';
      mail = await sendClassChangeNotice({ response, studentName, plan, stage: 'applied', actor });
      await recordMail(response.id, '수업 변경 안내', mail, actor);
    }
  }

  if (!input.silentNote) {
    const payload: CorrectionPayload = {
      stage: 'reconcile',
      questionKey: null,
      from: [],
      to: [],
      enrollments: planEffects(plan),
      notified: input.notify,
    };
    await addResponseNote({
      responseId: response.id,
      kind: 'correction',
      body: (input.noteBody ? `${input.noteBody}\n` : '') + describePlan(plan).join('\n'),
      authorId: actor.id,
      authorName: actor.name,
      system: true,
      payload,
    });
  }

  return {
    plan,
    noop: false,
    noticeKind,
    mail,
    summary: `${describePlan(plan).join(' / ')} · ${mailSummary(input.notify ? mail : null)}`,
  };
}

// ─────────────────────────────────────────────────────────────────
// 과목 정정 — 답 + 배정 + 이력 + 안내
// ─────────────────────────────────────────────────────────────────

export interface SubjectChangeInput {
  response: FormResponseRow;
  /** 현재 신청서 문안(정정은 현재 선택지로 고른다) */
  form: { id: number; schema_json: string; schema_version: number };
  nextKeys: string[];
  reason: string | null;
  notify: boolean;
  actor: RunActor;
}

export type SubjectChangeFailure =
  | { ok: false; step: 'validate'; error: CorrectionError }
  | { ok: false; step: 'answers' | 'enrollments' | 'note' | 'notice'; message: string };

export interface SubjectChangeSuccess {
  ok: true;
  from: CorrectionOptionRef[];
  to: CorrectionOptionRef[];
  plan: EnrollmentPlan;
  mail: NotifyResult | null;
  summary: string;
}

/** 정정 전 미리보기 — 모달이 "저장하면 이렇게 됩니다"를 그리는 데 쓴다. */
export async function previewSubjectChange(input: {
  response: FormResponseRow;
  form: { id: number; schema_json: string; schema_version: number };
  nextKeys: string[];
}): Promise<
  | { ok: true; from: CorrectionOptionRef[]; to: CorrectionOptionRef[]; plan: EnrollmentPlan; hasStudent: boolean }
  | { ok: false; error: CorrectionError }
> {
  const schema = JSON.parse(input.form.schema_json) as FormSchema;
  const q = findSubjectQuestion(schema);
  if (!q) return { ok: false, error: { code: 'noQuestion' } };
  const answers = JSON.parse(input.response.answers_json) as Answers;
  const applied = applySubjectCorrection(q, answers, input.nextKeys);
  if (!applied.ok) return { ok: false, error: applied.error };

  const from = optionRefs(q, pickedKeys(q, answers));
  const to = optionRefs(q, input.nextKeys);
  const nextSelections = input.nextKeys.map((key) => {
    const o = q.options?.find((x) => x.key === key);
    return { option_key: key, option_label_ko: o?.label.ko ?? key, program_id: o?.programId ?? null };
  });
  const loaded = await loadPlan(input.response, nextSelections);
  return { ok: true, from, to, plan: loaded.plan, hasStudent: loaded.hasStudent };
}

export async function applySubjectChange(
  input: SubjectChangeInput & { plannedNoteId?: number | null }
): Promise<SubjectChangeSuccess | SubjectChangeFailure> {
  const { response, actor } = input;
  const schema = JSON.parse(input.form.schema_json) as FormSchema;
  const q = findSubjectQuestion(schema);
  if (!q) return { ok: false, step: 'validate', error: { code: 'noQuestion' } };
  const answers = JSON.parse(response.answers_json) as Answers;
  const applied = applySubjectCorrection(q, answers, input.nextKeys);
  if (!applied.ok) return { ok: false, step: 'validate', error: applied.error };

  const from = optionRefs(q, pickedKeys(q, answers));
  const to = optionRefs(q, input.nextKeys);
  const change = describeDiff(from, to);

  // 1) 답 + 파생. 문안 버전은 현재로.
  try {
    await updateResponseAnswers({
      responseId: response.id,
      answers: applied.answers,
      schemaVersion: input.form.schema_version,
    });
  } catch (e) {
    console.error('정정: 답 갱신 실패', e);
    return { ok: false, step: 'answers', message: '답을 저장하지 못했습니다. 다시 시도해 주세요.' };
  }

  // 2) 배정. 배정 이력이 있는 줄기에서만 의미가 있다 — 배정 전이면 계획이 비어 noop.
  const fresh = { ...response, answers_json: JSON.stringify(applied.answers) };
  let plan: EnrollmentPlan;
  try {
    const loaded = await loadPlan(fresh);
    plan = loaded.plan;
    if (loaded.hasStudent && !isPlanNoop(plan)) await executePlan(plan, fresh, actor);
  } catch (e) {
    console.error('정정: 배정 조정 실패', e);
    return {
      ok: false,
      step: 'enrollments',
      message:
        '과목은 바뀌었지만 수업 명단을 맞추지 못했습니다. 상세 화면의 ‘배정 맞추기’를 눌러 이어 주세요.',
    };
  }

  // 3) 이력
  const member = response.student_user_id ? await getMemberById(response.student_user_id) : null;
  const studentName = member?.name ?? response.student_name;
  const payload: CorrectionPayload = {
    stage: 'applied',
    questionKey: q.key,
    from,
    to,
    schemaVersion:
      response.form_schema_version !== input.form.schema_version
        ? { from: response.form_schema_version, to: input.form.schema_version }
        : undefined,
    enrollments: planEffects(plan),
    notified: input.notify,
    plannedNoteId: input.plannedNoteId ?? null,
    reason: input.reason,
  };
  try {
    const lines = [`신청 과목 정정: ${change}`, ...describePlan(plan)];
    if (input.reason) lines.push(`사유: ${input.reason}`);
    await addResponseNote({
      responseId: response.id,
      kind: 'correction',
      body: lines.join('\n'),
      authorId: actor.id,
      authorName: actor.name,
      system: true,
      payload,
    });
    if (input.plannedNoteId) {
      await updateNotePayload(input.plannedNoteId, {
        ...(await plannedPayload(input.plannedNoteId)),
        stage: 'applied',
      } as CorrectionPayload);
    }
  } catch (e) {
    console.error('정정: 이력 기록 실패', e);
    return { ok: false, step: 'note', message: '정정은 됐지만 이력을 남기지 못했습니다. 메모로 남겨 주세요.' };
  }

  // 4) 안내 — 배정이 바뀌었으면 '수업 변경', 아니면 '신청 내용 변경'
  let mail: NotifyResult | null = null;
  if (input.notify) {
    try {
      if (!isPlanNoop(plan)) {
        mail = await sendClassChangeNotice({ response: fresh, studentName, plan, stage: 'applied', actor });
        await recordMail(response.id, '수업 변경 안내', mail, actor);
      } else {
        mail = await sendSubjectChangeNotice({ response: fresh, studentName, change, actor });
        await recordMail(response.id, '신청 내용 변경 안내', mail, actor);
      }
    } catch (e) {
      console.error('정정: 안내 발송 실패', e);
      return {
        ok: false,
        step: 'notice',
        message: '정정과 배정은 끝났지만 안내 메일이 나가지 않았습니다. ‘메일 보내기’로 직접 알려 주세요.',
      };
    }
  }

  const summary =
    `과목 정정 완료: ${change}` +
    (isPlanNoop(plan) ? '' : ` · ${describePlan(plan).join(' / ')}`) +
    ` · ${mailSummary(input.notify ? mail : null)}`;
  return { ok: true, from, to, plan, mail, summary };
}

async function plannedPayload(noteId: number): Promise<CorrectionPayload | null> {
  const note = await getResponseNoteById(noteId);
  return note?.payload_json ? (JSON.parse(note.payload_json) as CorrectionPayload) : null;
}

/**
 * 예고 — 답·배정은 그대로 두고 "언제부터 이렇게 바뀝니다"만 보낸다.
 * 이력에 stage='planned' 로 남고, 상세 화면이 [지금 적용]/[철회]를 준다.
 */
export async function planSubjectChange(
  input: SubjectChangeInput & { effective: string | null }
): Promise<
  | { ok: true; noteId: number; mail: NotifyResult | null; summary: string }
  | SubjectChangeFailure
> {
  const { response, actor } = input;
  const preview = await previewSubjectChange({ response, form: input.form, nextKeys: input.nextKeys });
  if (!preview.ok) return { ok: false, step: 'validate', error: preview.error };

  const change = describeDiff(preview.from, preview.to);
  const member = response.student_user_id ? await getMemberById(response.student_user_id) : null;
  const studentName = member?.name ?? response.student_name;

  const payload: CorrectionPayload = {
    stage: 'planned',
    questionKey: findSubjectQuestion(JSON.parse(input.form.schema_json) as FormSchema)?.key ?? null,
    from: preview.from,
    to: preview.to,
    enrollments: planEffects(preview.plan),
    notified: input.notify,
    effectiveDate: input.effective,
    reason: input.reason,
  };
  let noteId: number;
  try {
    const lines = [
      `정정 예고: ${change}` + (input.effective ? ` (${input.effective}부터)` : ''),
      ...describePlan(preview.plan),
    ];
    if (input.reason) lines.push(`사유: ${input.reason}`);
    noteId = await addResponseNote({
      responseId: response.id,
      kind: 'correction',
      body: lines.join('\n'),
      authorId: actor.id,
      authorName: actor.name,
      system: true,
      payload,
    });
  } catch (e) {
    console.error('예고: 이력 기록 실패', e);
    return { ok: false, step: 'note', message: '예고를 기록하지 못했습니다. 다시 시도해 주세요.' };
  }

  let mail: NotifyResult | null = null;
  if (input.notify) {
    try {
      mail = await sendClassChangeNotice({
        response,
        studentName,
        plan: preview.plan,
        stage: 'planned',
        effective: input.effective,
        actor,
      });
      await recordMail(response.id, '수업 변경 예고', mail, actor);
    } catch (e) {
      console.error('예고: 안내 발송 실패', e);
      return { ok: false, step: 'notice', message: '예고는 기록됐지만 안내 메일이 나가지 않았습니다.' };
    }
  }
  return { ok: true, noteId, mail, summary: `정정 예고를 남겼습니다: ${change} · ${mailSummary(input.notify ? mail : null)}` };
}

/** 예고 철회 — 기록만 바꾼다. 안내는 사람이 판단해 '메일 보내기'로. */
export async function withdrawPlannedChange(noteId: number, actor: RunActor, responseId: number): Promise<boolean> {
  const p = await plannedPayload(noteId);
  if (!p || p.stage !== 'planned') return false;
  await updateNotePayload(noteId, { ...p, stage: 'withdrawn' });
  await addResponseNote({
    responseId,
    kind: 'note',
    body: `정정 예고를 철회했습니다: ${describeDiff(p.from, p.to)}`,
    authorId: actor.id,
    authorName: actor.name,
    system: true,
  });
  return true;
}

/** 예고된 정정을 지금 적용 — 예고 payload 의 to 로 applySubjectChange 를 돌린다. */
export async function applyPlannedChange(input: {
  noteId: number;
  response: FormResponseRow;
  actor: RunActor;
  notify: boolean;
}): Promise<SubjectChangeSuccess | SubjectChangeFailure> {
  const p = await plannedPayload(input.noteId);
  if (!p || p.stage !== 'planned') {
    return { ok: false, step: 'answers', message: '예고된 정정을 찾을 수 없습니다(이미 적용했거나 철회했습니다).' };
  }
  const form = await getFormById(input.response.form_id);
  if (!form) return { ok: false, step: 'answers', message: '신청서를 찾을 수 없습니다.' };
  return applySubjectChange({
    response: input.response,
    form,
    nextKeys: p.to.map((o) => o.key),
    reason: p.reason ?? null,
    notify: input.notify,
    actor: input.actor,
    plannedNoteId: input.noteId,
  });
}

/**
 * 재제출이 무엇을 바꿨나 — "A · B → C" 한 줄. 파생 선택(라벨 스냅샷)끼리 비교한다.
 * 접수 메일·이력·목록 배지가 같은 문장을 쓴다. 과목 문항이 없는 신청서면 null.
 */
export async function describeResubmission(
  previousResponseId: number,
  newResponseId: number
): Promise<string | null> {
  const [prev, next] = await Promise.all([getSelections(previousResponseId), getSelections(newResponseId)]);
  if (prev.length === 0 && next.length === 0) return null;
  const ref = (s: { option_key: string; option_label_ko: string | null }) => ({
    key: s.option_key,
    label: s.option_label_ko ?? s.option_key,
  });
  return describeDiff(prev.map(ref), next.map(ref));
}
