/**
 * 신분과 관리 권한의 분리 회귀 시험
 *
 *   node --test lib/admin/permissions.test.ts
 *
 * 이 분리(0034)의 요점은 한 문장이다: **관리 권한을 준다고 신분을 잃지 않는다.**
 * 예전에는 선생님에게 관리를 맡기려면 role을 'admin'으로 바꿔야 했고, 그 순간
 * 담당 수업 같은 선생님 메뉴가 통째로 사라졌다. 화면을 눌러 보면 "메뉴가 많아졌다"는
 * 것만 보이고 무엇이 사라졌는지는 보이지 않으므로, 그 부분을 시험으로 붙잡아 둔다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { effectiveAllowed, type MenuViewer } from './menuAccess.ts';
import type { MenuNode, PermMatrix } from '../../types/permissions.ts';

/** 선생님에게만 열린 메뉴(예: 참여 현황) */
const staffOnly: MenuNode = {
  key: 'participation',
  href: '/admin/participation',
  label: '참여 현황',
  iconKey: 'calendar',
  group: 'show',
  defaultRoles: ['teacher'],
};

/** 원생·학부모에게 열린 메뉴(예: 내 수업) */
const memberOnly: MenuNode = {
  key: 'my-classes',
  href: '/admin/my-classes',
  label: '내 수업',
  iconKey: 'calendar',
  group: 'lesson',
  defaultRoles: ['student', 'parent'],
};

const EMPTY: PermMatrix = {};
const viewer = (role: MenuViewer['role'], isAdmin = false): MenuViewer => ({ role, isAdmin });

/* ── 분리의 요점 ───────────────────────────────────────────────────────── */

test('선생님에게 관리 권한을 줘도 선생님 메뉴를 잃지 않는다', () => {
  const plainTeacher = viewer('teacher');
  const adminTeacher = viewer('teacher', true);

  // 분리 전에는 이 사람이 role='admin'이 되면서 아래가 false로 뒤집혔다.
  assert.equal(effectiveAllowed(staffOnly, plainTeacher, EMPTY), true);
  assert.equal(effectiveAllowed(staffOnly, adminTeacher, EMPTY), true, '선생님 메뉴가 사라졌다');
});

test('관리 권한은 신분이 못 여는 메뉴까지 연다', () => {
  assert.equal(effectiveAllowed(memberOnly, viewer('teacher'), EMPTY), false);
  assert.equal(effectiveAllowed(memberOnly, viewer('teacher', true), EMPTY), true);
});

test('원생도 관리 권한을 가질 수 있다 — 신분은 그대로다', () => {
  const adminStudent = viewer('student', true);
  assert.equal(effectiveAllowed(memberOnly, adminStudent, EMPTY), true, '원생 메뉴를 잃었다');
  assert.equal(effectiveAllowed(staffOnly, adminStudent, EMPTY), true, '관리 메뉴가 안 열렸다');
});

test('권한을 거두면 신분만 남는다 — 되돌릴 수 있어야 한다', () => {
  assert.equal(effectiveAllowed(memberOnly, viewer('teacher', true), EMPTY), true);
  assert.equal(effectiveAllowed(memberOnly, viewer('teacher', false), EMPTY), false);
});

/* ── 신분별 기본값 ─────────────────────────────────────────────────────── */

test('운영(staff) 신분 자체로는 아무 메뉴도 열리지 않는다', () => {
  // 권한이 붙어야 의미가 있는 계정이다. 신분만으로 뭔가 열리면 그게 사고다.
  assert.equal(effectiveAllowed(staffOnly, viewer('staff'), EMPTY), false);
  assert.equal(effectiveAllowed(memberOnly, viewer('staff'), EMPTY), false);
  assert.equal(effectiveAllowed(staffOnly, viewer('staff', true), EMPTY), true);
});

test('학부모는 자녀 쪽 메뉴만', () => {
  assert.equal(effectiveAllowed(memberOnly, viewer('parent'), EMPTY), true);
  assert.equal(effectiveAllowed(staffOnly, viewer('parent'), EMPTY), false);
});

/* ── DB 매트릭스와의 관계 ──────────────────────────────────────────────── */

test('DB가 신분을 막아도 관리 권한은 통과한다', () => {
  // 매트릭스는 신분의 문이다. 관리 권한은 그 문을 지나지 않는다(락아웃 면역).
  const denied: PermMatrix = { participation: { teacher: false } };
  assert.equal(effectiveAllowed(staffOnly, viewer('teacher'), denied), false);
  assert.equal(effectiveAllowed(staffOnly, viewer('teacher', true), denied), true);
});

test('DB 명시 값이 레지스트리 기본값을 이긴다(신분에 한해)', () => {
  const opened: PermMatrix = { 'my-classes': { teacher: true } };
  assert.equal(effectiveAllowed(memberOnly, viewer('teacher'), opened), true);
});

test('requireRole 메뉴는 신분 하드플로어 — 그래도 관리 권한이 우선한다', () => {
  const adminTool: MenuNode = {
    key: 'settings.permissions',
    href: '/admin/permissions',
    label: '권한 관리',
    iconKey: 'settings',
    group: 'ops',
    defaultRoles: [],
    requireRole: 'teacher',
  };
  assert.equal(effectiveAllowed(adminTool, viewer('student'), EMPTY), false);
  assert.equal(effectiveAllowed(adminTool, viewer('teacher'), EMPTY), true);
  assert.equal(effectiveAllowed(adminTool, viewer('student', true), EMPTY), true);
});
