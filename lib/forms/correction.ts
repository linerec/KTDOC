/**
 * lib/forms/correction.ts — 신청 과목 정정의 판단 (순수 함수)
 *
 * 응답 #173이 과목을 잘못 넣고 배정까지 끝난 뒤, 고치는 길이 "수업 화면에서 해제하고
 * 신청서를 다시 받는" 손절차뿐이었다. 그 절차는 배정을 남기고, 아무에게도 알리지
 * 않았고, 무엇이 바뀌었는지 기록하지 않았다.
 *
 * 여기 있는 것은 세 가지 판단이고 전부 DB·React를 모른다:
 *   1. 과목 답을 바꾸면 답이 어떻게 되는가            — applySubjectCorrection
 *   2. 무엇이 빠지고 무엇이 들어왔는가                 — diffOptions
 *   3. 배정을 어떻게 맞춰야 하는가                    — planEnrollmentChanges
 *
 * **"신청 과목 = 배정"은 3번 하나가 지킨다.** 신청 화면의 '수업에 넣기', 정정, 재제출
 * 뒤 배정, 취소 시 회수, 어긋남 복구가 전부 이 계획을 지난다. 화면마다 배정을 다시
 * 계산하면 어긋나고, 어긋난 쪽은 늘 "수업 있음" 쪽이다.
 *
 * 계획은 **이 응답 줄기가 만든 배정만 거둔다.** 운영진이 수업 화면에서 직접 넣거나
 * 취소한 배정(source_response_id 가 다르거나 NULL)은 남의 결정이라 건드리지 않는다.
 * 자기 줄기가 취소한 것은 다시 고르면 되살린다.
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 상대 경로 + .ts 로 import 한다.
 */

import { exclusiveConflicts } from './optionGroups.ts';
import type {
  Answers,
  CorrectionEnrollmentEffect,
  CorrectionOptionRef,
  FormOption,
  FormQuestion,
  FormSchema,
} from '../../types/forms.ts';
import type { EnrollmentStatus } from '../../types/programs.ts';

// ─────────────────────────────────────────────────────────────────
// 1. 과목 문항과 답
// ─────────────────────────────────────────────────────────────────

/** 과목 문항 — `selectionOf: 'class'` 를 단 첫 문항. 신청서마다 하나뿐이다. */
export function findSubjectQuestion(schema: FormSchema): FormQuestion | null {
  for (const s of schema.sections) {
    for (const q of s.questions) {
      if (q.selectionOf === 'class' && !q.retired) return q;
    }
  }
  return null;
}

/** 화면에 낼 선택지 — 툼스톤(retired)은 빼되, 지금 골라져 있는 것은 남긴다(해제할 수 있어야 한다). */
export function selectableOptions(question: FormQuestion, current: string[]): FormOption[] {
  const cur = new Set(current);
  return (question.options ?? []).filter((o) => !o.retired || cur.has(o.key));
}

/** 답에서 과목 키 목록. single 이면 0~1개, multi 면 배열. */
export function pickedKeys(question: FormQuestion, answers: Answers): string[] {
  const v = answers[question.key];
  if (Array.isArray(v)) return v.filter((k): k is string => typeof k === 'string');
  if (typeof v === 'string' && v) return [v];
  return [];
}

/** 키 목록을 라벨 붙은 참조로. 이력에는 **그때의 라벨**을 스냅샷한다(선택지 이름은 바뀐다). */
export function optionRefs(question: FormQuestion, keys: string[]): CorrectionOptionRef[] {
  return keys.map((key) => ({
    key,
    label: question.options?.find((o) => o.key === key)?.label.ko ?? key,
  }));
}

export type CorrectionError =
  | { code: 'noQuestion' }
  | { code: 'badOptions'; keys: string[] }
  | { code: 'pickAtLeast'; min: number }
  | { code: 'exclusiveConflict'; keys: string[] }
  | { code: 'noChange' };

/**
 * 과목 답을 바꾼 새 answers. 다른 문항은 손대지 않는다.
 * 검증은 **이 문항만** 한다 — 옛 문안으로 낸 응답을 현재 문안 전체로 다시 검사하면
 * 그 사이 추가된 필수 문항에 걸려 정정 자체가 막힌다.
 */
export function applySubjectCorrection(
  question: FormQuestion,
  answers: Answers,
  nextKeys: string[]
): { ok: true; answers: Answers } | { ok: false; error: CorrectionError } {
  const options = question.options ?? [];
  const valid = new Set(options.filter((o) => !o.retired).map((o) => o.key));
  const unique = Array.from(new Set(nextKeys));

  const bad = unique.filter((k) => !valid.has(k));
  if (bad.length) return { ok: false, error: { code: 'badOptions', keys: bad } };

  const min = question.minSelect ?? (question.required ? 1 : 0);
  if (unique.length < min) return { ok: false, error: { code: 'pickAtLeast', min } };

  if (question.type === 'multi') {
    const clash = exclusiveConflicts(options, unique)[0];
    if (clash) return { ok: false, error: { code: 'exclusiveConflict', keys: clash } };
  }

  const before = pickedKeys(question, answers);
  if (sameSet(before, unique)) return { ok: false, error: { code: 'noChange' } };

  const value = question.type === 'multi' ? unique : (unique[0] ?? null);
  return { ok: true, answers: { ...answers, [question.key]: value } };
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((k) => s.has(k));
}

// ─────────────────────────────────────────────────────────────────
// 2. 무엇이 바뀌었나
// ─────────────────────────────────────────────────────────────────

export interface OptionDiff {
  added: CorrectionOptionRef[];
  removed: CorrectionOptionRef[];
  kept: CorrectionOptionRef[];
}

export function diffOptions(prev: CorrectionOptionRef[], next: CorrectionOptionRef[]): OptionDiff {
  const p = new Set(prev.map((o) => o.key));
  const n = new Set(next.map((o) => o.key));
  return {
    added: next.filter((o) => !p.has(o.key)),
    removed: prev.filter((o) => !n.has(o.key)),
    kept: next.filter((o) => p.has(o.key)),
  };
}

/** "A · B → C" 꼴 한 줄. 이력 본문·메일·알림함이 같은 문장을 쓴다. */
export function describeDiff(prev: CorrectionOptionRef[], next: CorrectionOptionRef[]): string {
  const join = (xs: CorrectionOptionRef[]) =>
    xs.length ? xs.map((o) => o.label.trim()).join(' · ') : '(없음)';
  return `${join(prev)} → ${join(next)}`;
}

// ─────────────────────────────────────────────────────────────────
// 3. 배정을 어떻게 맞추나
// ─────────────────────────────────────────────────────────────────

/** 계획이 보는 배정 행의 최소 모양(ProgramEnrollment 의 부분집합). */
export interface PlanEnrollment {
  id: number;
  program_id: number;
  user_id: string;
  status: EnrollmentStatus;
  source_response_id: number | null;
}

export interface PlanProgram {
  id: number;
  title_ko: string;
  /** 학기 시작일 YYYY-MM-DD. 비우면 상시 수업. */
  term_start_date: string | null;
}

export interface PlanSelection {
  option_key: string;
  option_label_ko: string | null;
  program_id: number | null;
}

export interface PlanInput {
  /** 배정 대상 — 응답의 student_user_id. 제출자(학부모)가 아니다. */
  studentUserId: string;
  /** 신청 과목(현재 답에서 파생된 것). */
  selections: PlanSelection[];
  /** 이 응답 줄기(자기 + 대체한 옛 응답들)의 id. 배정의 source 가 여기 들어가야 "우리 것". */
  chainIds: number[];
  /** 학생의 배정 행 전부 + 이 줄기가 만든 배정 전부(다른 사람 명의로 잘못 간 것 포함). */
  enrollments: PlanEnrollment[];
  programs: Map<number, PlanProgram>;
  /** 오늘 YYYY-MM-DD(학원 시간대). 학기 시작 전이면 삭제, 뒤면 취소로 내린다. */
  today: string;
}

export interface PlanAdd {
  programId: number;
  title: string;
}
export interface PlanRevive {
  enrollmentId: number;
  programId: number;
  title: string;
}
export interface PlanRemove {
  enrollmentId: number;
  programId: number;
  title: string;
  /** delete: 시작 전이라 행을 지운다 · cancel: 시작 뒤라 '취소'로 남긴다 */
  mode: 'delete' | 'cancel';
  /** not_selected: 신청 과목에서 빠졌다 · wrong_user: 다른 회원 명의로 가 있다(재연결) */
  reason: 'not_selected' | 'wrong_user';
}

export interface EnrollmentPlan {
  add: PlanAdd[];
  revive: PlanRevive[];
  remove: PlanRemove[];
  /** 이미 맞게 들어가 있어 그대로 두는 것 */
  keep: PlanAdd[];
  /** 수업이 연결되지 않은 과목 — 배정을 만들 수 없다 */
  unlinked: Array<{ optionKey: string; label: string }>;
  /** 운영진이 수업 화면에서 취소로 내려 둔 것(우리 줄기 아님) — 되살리지 않는다 */
  skippedCancelled: PlanAdd[];
}

export function planEnrollmentChanges(input: PlanInput): EnrollmentPlan {
  const chain = new Set(input.chainIds);
  const title = (pid: number) => input.programs.get(pid)?.title_ko ?? `수업 #${pid}`;
  const removeMode = (pid: number): 'delete' | 'cancel' => {
    const start = input.programs.get(pid)?.term_start_date?.slice(0, 10);
    return start && start <= input.today ? 'cancel' : 'delete';
  };

  const plan: EnrollmentPlan = {
    add: [],
    revive: [],
    remove: [],
    keep: [],
    unlinked: [],
    skippedCancelled: [],
  };

  // 원하는 수업 — 선택지 둘이 같은 수업을 가리키면(난타 1드럼·3드럼) 하나로 접는다.
  const desired = new Set<number>();
  for (const s of input.selections) {
    if (s.program_id == null) {
      plan.unlinked.push({ optionKey: s.option_key, label: s.option_label_ko ?? s.option_key });
      continue;
    }
    desired.add(s.program_id);
  }

  const mine = input.enrollments.filter((e) => e.user_id === input.studentUserId);
  const ours = (e: PlanEnrollment) => e.source_response_id != null && chain.has(e.source_response_id);

  for (const pid of desired) {
    const existing = mine.find((e) => e.program_id === pid);
    if (!existing) {
      plan.add.push({ programId: pid, title: title(pid) });
    } else if (existing.status !== 'cancelled') {
      plan.keep.push({ programId: pid, title: title(pid) });
    } else if (ours(existing)) {
      plan.revive.push({ enrollmentId: existing.id, programId: pid, title: title(pid) });
    } else {
      plan.skippedCancelled.push({ programId: pid, title: title(pid) });
    }
  }

  for (const e of input.enrollments) {
    if (!ours(e) || e.status === 'cancelled') continue;
    if (e.user_id !== input.studentUserId) {
      plan.remove.push({
        enrollmentId: e.id,
        programId: e.program_id,
        title: title(e.program_id),
        mode: removeMode(e.program_id),
        reason: 'wrong_user',
      });
    } else if (!desired.has(e.program_id)) {
      plan.remove.push({
        enrollmentId: e.id,
        programId: e.program_id,
        title: title(e.program_id),
        mode: removeMode(e.program_id),
        reason: 'not_selected',
      });
    }
  }

  return plan;
}

/** 아무것도 바꾸지 않는 계획인가(어긋남 없음). */
export function isPlanNoop(plan: EnrollmentPlan): boolean {
  return plan.add.length === 0 && plan.revive.length === 0 && plan.remove.length === 0;
}

/** 이력 payload 에 남길 모양으로. */
export function planEffects(plan: EnrollmentPlan): CorrectionEnrollmentEffect[] {
  return [
    ...plan.add.map((a) => ({ programId: a.programId, title: a.title, action: 'added' as const })),
    ...plan.revive.map((r) => ({ programId: r.programId, title: r.title, action: 'revived' as const })),
    ...plan.remove.map((r) => ({
      programId: r.programId,
      title: r.title,
      action: r.mode === 'delete' ? ('deleted' as const) : ('cancelled' as const),
    })),
  ];
}

/**
 * 사람이 읽는 계획 — 모달의 "저장하면 이렇게 됩니다"와 이력 본문이 같은 문장을 쓴다.
 * 빈 배열이면 "배정은 그대로입니다".
 */
export function describePlan(plan: EnrollmentPlan): string[] {
  const lines: string[] = [];
  for (const r of plan.remove) {
    const why = r.reason === 'wrong_user' ? '다른 회원 명의로 가 있던 배정' : '신청에서 빠진 수업';
    lines.push(
      r.mode === 'delete'
        ? `${r.title} — 배정 해제 (${why}, 시작 전이라 명단에서 지웁니다)`
        : `${r.title} — 취소로 내림 (${why}, 이미 시작한 수업이라 기록은 남깁니다)`
    );
  }
  for (const a of plan.add) lines.push(`${a.title} — 새로 배정`);
  for (const r of plan.revive) lines.push(`${r.title} — 취소했던 배정을 되살림`);
  for (const u of plan.unlinked)
    lines.push(`${u.label.trim()} — 수업이 연결되지 않아 배정을 만들 수 없습니다`);
  for (const s of plan.skippedCancelled)
    lines.push(`${s.title} — 수업 화면에서 취소로 내려 둔 배정이라 그대로 둡니다`);
  return lines;
}

/**
 * 안내 메일·알림함에 실을 "빠진 수업 / 새 수업" — 계획에서 신청자에게 보여도 되는 부분만.
 * 삭제·취소의 구분, 미연결, 남의 결정 같은 운영 사정은 싣지 않는다.
 */
export function planForNotice(plan: EnrollmentPlan): { left: string[]; joined: string[] } {
  return {
    left: plan.remove.filter((r) => r.reason === 'not_selected').map((r) => r.title),
    joined: [...plan.add, ...plan.revive].map((a) => a.title),
  };
}
