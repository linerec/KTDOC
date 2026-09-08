import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applySubjectCorrection,
  describeDiff,
  describePlan,
  diffOptions,
  findSubjectQuestion,
  isPlanNoop,
  optionRefs,
  pickedKeys,
  planEnrollmentChanges,
  planForNotice,
  selectableOptions,
  type PlanEnrollment,
  type PlanProgram,
} from './correction.ts';
import { seasonPreset2026 } from './presets.ts';
import type { Answers } from '../../types/forms.ts';

const schema = seasonPreset2026();
const q = findSubjectQuestion(schema)!;

// ── 1. 과목 답 ────────────────────────────────────────────────────

test('과목 문항은 selectionOf=class 인 문항 하나다', () => {
  assert.equal(q.key, 'q7_classes');
  assert.equal(q.type, 'multi');
});

test('답을 바꾸면 그 문항만 바뀌고 나머지는 그대로다', () => {
  const answers: Answers = { q7_classes: ['kdrum_ensemble', 'youth_repertoire'], other: 'x' };
  const r = applySubjectCorrection(q, answers, ['advanced_dance']);
  assert.ok(r.ok);
  assert.deepEqual(r.answers.q7_classes, ['advanced_dance']);
  assert.equal(r.answers.other, 'x');
  // 입력은 건드리지 않는다
  assert.deepEqual(answers.q7_classes, ['kdrum_ensemble', 'youth_repertoire']);
});

test('같은 과목으로 저장하면 noChange 다 — 빈 이력을 남기지 않는다', () => {
  const r = applySubjectCorrection(q, { q7_classes: ['kids_dance'] }, ['kids_dance']);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'noChange');
});

test('없는 선택지·빈 선택은 막는다', () => {
  const bad = applySubjectCorrection(q, { q7_classes: ['kids_dance'] }, ['nope']);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error.code, 'badOptions');
  const empty = applySubjectCorrection(q, { q7_classes: ['kids_dance'] }, []);
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.error.code, 'pickAtLeast');
});

test('함께 고를 수 없는 짝(삼고무·오고무)은 정정에서도 막는다', () => {
  // 프리셋은 짝을 데이터로 두지 않는다(실제 신청서가 편집 화면에서 단다). 여기서 단다.
  const grouped = {
    ...q,
    options: (q.options ?? []).map((o) =>
      o.key === 'drums_3standing' || o.key === 'drums_5standing'
        ? { ...o, exclusiveGroup: 'standing_drums' }
        : o
    ),
  };
  const r = applySubjectCorrection(grouped, { q7_classes: ['kids_dance'] }, [
    'drums_3standing',
    'drums_5standing',
  ]);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'exclusiveConflict');
});

test('툼스톤 선택지는 목록에서 빠지되 이미 골라진 것은 남는다', () => {
  const withRetired = {
    ...q,
    options: [...(q.options ?? []), { key: 'old', label: { ko: '옛 과목', en: 'Old' }, retired: true }],
  };
  assert.ok(!selectableOptions(withRetired, []).some((o) => o.key === 'old'));
  assert.ok(selectableOptions(withRetired, ['old']).some((o) => o.key === 'old'));
  // 그러나 새로 고를 수는 없다
  const r = applySubjectCorrection(withRetired, { q7_classes: ['kids_dance'] }, ['old']);
  assert.equal(r.ok, false);
});

test('single 문항이면 값이 배열이 아니다', () => {
  const single = { ...q, type: 'single' as const, minSelect: undefined };
  const r = applySubjectCorrection(single, { q7_classes: 'kids_dance' }, ['advanced_dance']);
  assert.ok(r.ok);
  assert.equal(r.answers.q7_classes, 'advanced_dance');
  assert.deepEqual(pickedKeys(single, r.answers), ['advanced_dance']);
});

// ── 2. diff ──────────────────────────────────────────────────────

test('diff 는 빠진 것·들어온 것·남은 것을 가르고, 라벨은 스냅샷이다', () => {
  const prev = optionRefs(q, ['kdrum_ensemble', 'youth_repertoire']);
  const next = optionRefs(q, ['youth_repertoire', 'advanced_dance']);
  const d = diffOptions(prev, next);
  assert.deepEqual(d.removed.map((o) => o.key), ['kdrum_ensemble']);
  assert.deepEqual(d.added.map((o) => o.key), ['advanced_dance']);
  assert.deepEqual(d.kept.map((o) => o.key), ['youth_repertoire']);
  assert.match(describeDiff(prev, next), /K-DRUM.*→.*/);
  assert.equal(describeDiff([], next).startsWith('(없음) →'), true);
});

// ── 3. 배정 계획 ─────────────────────────────────────────────────

const programs = new Map<number, PlanProgram>([
  [15, { id: 15, title_ko: '중고등부 작품반', term_start_date: '2026-09-13' }],
  [16, { id: 16, title_ko: 'K-드럼 앙상블', term_start_date: '2026-09-13' }],
  [17, { id: 17, title_ko: '성인반', term_start_date: null }],
  [12, { id: 12, title_ko: '기초 난타', term_start_date: '2026-08-01' }],
]);
const STUDENT = 'stu-1';
const sel = (key: string, pid: number | null) => ({
  option_key: key,
  option_label_ko: key,
  program_id: pid,
});
const enr = (
  id: number,
  pid: number,
  extra: Partial<PlanEnrollment> = {}
): PlanEnrollment => ({
  id,
  program_id: pid,
  user_id: STUDENT,
  status: 'active',
  source_response_id: 173,
  ...extra,
});

test('#173 시나리오: 잘못 들어간 수업은 빠지고 새 수업이 들어간다 (시작 전 → 삭제)', () => {
  const plan = planEnrollmentChanges({
    studentUserId: STUDENT,
    selections: [sel('youth_repertoire', 15), sel('advanced_dance', 17)],
    chainIds: [173],
    enrollments: [enr(59, 16), enr(60, 15)],
    programs,
    today: '2026-09-07',
  });
  assert.deepEqual(plan.add.map((a) => a.programId), [17]);
  assert.deepEqual(plan.keep.map((k) => k.programId), [15]);
  assert.equal(plan.remove.length, 1);
  assert.equal(plan.remove[0].enrollmentId, 59);
  assert.equal(plan.remove[0].mode, 'delete');
  assert.equal(plan.remove[0].reason, 'not_selected');
  assert.equal(isPlanNoop(plan), false);
});

test('이미 시작한 수업에서 빠지면 삭제가 아니라 취소로 내린다', () => {
  const plan = planEnrollmentChanges({
    studentUserId: STUDENT,
    selections: [sel('advanced_dance', 17)],
    chainIds: [173],
    enrollments: [enr(1, 12)],
    programs,
    today: '2026-09-07',
  });
  assert.equal(plan.remove[0].mode, 'cancel');
});

test('학기 시작일 당일부터 취소 모드다', () => {
  const on = planEnrollmentChanges({
    studentUserId: STUDENT,
    selections: [],
    chainIds: [173],
    enrollments: [enr(1, 16)],
    programs,
    today: '2026-09-13',
  });
  assert.equal(on.remove[0].mode, 'cancel');
});

test('남의 결정은 건드리지 않는다 — 수업 화면에서 직접 넣은 배정은 신청에서 빠져도 남는다', () => {
  const plan = planEnrollmentChanges({
    studentUserId: STUDENT,
    selections: [sel('advanced_dance', 17)],
    chainIds: [173],
    enrollments: [enr(5, 16, { source_response_id: null })],
    programs,
    today: '2026-09-07',
  });
  assert.equal(plan.remove.length, 0);
  assert.deepEqual(plan.add.map((a) => a.programId), [17]);
});

test('다른 응답 줄기의 배정도 남의 것이다', () => {
  const plan = planEnrollmentChanges({
    studentUserId: STUDENT,
    selections: [],
    chainIds: [173],
    enrollments: [enr(5, 16, { source_response_id: 99 })],
    programs,
    today: '2026-09-07',
  });
  assert.equal(plan.remove.length, 0);
});

test('대체한 옛 응답이 만든 배정은 우리 줄기다', () => {
  const plan = planEnrollmentChanges({
    studentUserId: STUDENT,
    selections: [sel('advanced_dance', 17)],
    chainIds: [180, 173],
    enrollments: [enr(59, 16, { source_response_id: 173 })],
    programs,
    today: '2026-09-07',
  });
  assert.deepEqual(plan.remove.map((r) => r.enrollmentId), [59]);
});

test('수업 화면에서 취소로 내려 둔 것은 되살리지 않고, 우리 줄기가 취소한 것은 되살린다', () => {
  const plan = planEnrollmentChanges({
    studentUserId: STUDENT,
    selections: [sel('kdrum_ensemble', 16), sel('youth_repertoire', 15)],
    chainIds: [173],
    enrollments: [
      enr(1, 16, { status: 'cancelled', source_response_id: null }),
      enr(2, 15, { status: 'cancelled', source_response_id: 173 }),
    ],
    programs,
    today: '2026-09-07',
  });
  assert.deepEqual(plan.skippedCancelled.map((s) => s.programId), [16]);
  assert.deepEqual(plan.revive.map((r) => r.enrollmentId), [2]);
  assert.equal(plan.add.length, 0);
});

test('회원을 다시 연결했으면 이전 회원 명의의 배정을 거두고 새 회원에게 만든다', () => {
  const plan = planEnrollmentChanges({
    studentUserId: 'stu-2',
    selections: [sel('kdrum_ensemble', 16)],
    chainIds: [173],
    enrollments: [enr(59, 16, { user_id: STUDENT })],
    programs,
    today: '2026-09-07',
  });
  assert.equal(plan.remove[0].reason, 'wrong_user');
  assert.equal(plan.remove[0].enrollmentId, 59);
  assert.deepEqual(plan.add.map((a) => a.programId), [16]);
});

test('같은 수업을 가리키는 선택지 둘(난타 1드럼→3드럼)은 배정이 바뀌지 않는다', () => {
  const plan = planEnrollmentChanges({
    studentUserId: STUDENT,
    selections: [sel('nanta_3drum', 12)],
    chainIds: [173],
    enrollments: [enr(1, 12)],
    programs,
    today: '2026-09-07',
  });
  assert.ok(isPlanNoop(plan));
  assert.deepEqual(plan.keep.map((k) => k.programId), [12]);
});

test('수업이 연결되지 않은 과목은 배정 대신 unlinked 로 보고한다', () => {
  const plan = planEnrollmentChanges({
    studentUserId: STUDENT,
    selections: [sel('mystery', null)],
    chainIds: [173],
    enrollments: [],
    programs,
    today: '2026-09-07',
  });
  assert.equal(plan.unlinked.length, 1);
  assert.ok(isPlanNoop(plan));
  assert.match(describePlan(plan)[0], /연결되지 않아/);
});

test('계획은 멱등이다 — 적용된 상태로 다시 세우면 noop', () => {
  const after = planEnrollmentChanges({
    studentUserId: STUDENT,
    selections: [sel('youth_repertoire', 15), sel('advanced_dance', 17)],
    chainIds: [173],
    enrollments: [enr(60, 15), enr(61, 17)],
    programs,
    today: '2026-09-07',
  });
  assert.ok(isPlanNoop(after));
});

test('안내에는 신청자가 봐도 되는 것만 — 미연결·남의 결정·재연결 사정은 싣지 않는다', () => {
  const plan = planEnrollmentChanges({
    studentUserId: 'stu-2',
    selections: [sel('advanced_dance', 17), sel('mystery', null)],
    chainIds: [173],
    enrollments: [enr(59, 16, { user_id: STUDENT }), enr(60, 15, { user_id: 'stu-2' })],
    programs,
    today: '2026-09-07',
  });
  const n = planForNotice(plan);
  assert.deepEqual(n.left, ['중고등부 작품반']);
  assert.deepEqual(n.joined, ['성인반']);
});
