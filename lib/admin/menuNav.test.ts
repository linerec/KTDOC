/**
 * 사이드바에 없는 메뉴(hidden) 회귀 시험
 *
 *   node --test lib/admin/menuNav.test.ts
 *
 * 메뉴를 줄이는 방법은 두 가지다. 하나는 기능을 없애는 것이고, 다른 하나는
 * **진입점을 옮기는 것**이다. Q&A 관리가 후자다 — 사이드바에서는 사라지고
 * Q&A 페이지 안의 버튼으로 들어간다.
 *
 * 이때 조용히 깨지기 쉬운 것이 셋이라 여기서 붙잡아 둔다:
 *   1) 목록에서 뺐다고 권한까지 사라지면 안 된다(페이지는 여전히 스스로를 지킨다).
 *   2) 목록에서 뺐다고 라우팅 매핑이 끊기면 레이아웃이 fail-closed로 내친다.
 *   3) 숨은 페이지에 서 있는 동안 사이드바에서 아무것도 선택돼 있지 않으면
 *      "내가 어디 있는지"를 잃는다 — 부모 메뉴가 대신 켜져야 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getAllowedMenus, effectiveAllowedByKey, type MenuViewer } from './menuAccess.ts';
import { MENU_REGISTRY, getMenuNode } from './menu-registry.ts';
import { resolveMenuKey } from './resolveMenuKey.ts';
import type { PermMatrix } from '../../types/permissions.ts';

const EMPTY: PermMatrix = {};
const viewer = (role: MenuViewer['role'], isAdmin = false): MenuViewer => ({ role, isAdmin });

/* ── 숨김 메뉴의 계약 ──────────────────────────────────────────────────── */

test('숨김 메뉴는 누구의 사이드바에도 나오지 않는다 — 관리자도 마찬가지다', () => {
  const hidden = MENU_REGISTRY.filter((n) => n.hidden);
  assert.ok(hidden.length > 0, '숨김 메뉴가 하나도 없다면 이 시험이 지키는 게 없다');

  for (const v of [viewer('admin', true), viewer('teacher'), viewer('student')]) {
    const keys = getAllowedMenus(v, EMPTY).map((m) => m.key);
    for (const node of hidden) {
      assert.ok(!keys.includes(node.key), `${node.key}가 사이드바에 남아 있다`);
    }
  }
});

test('숨김 메뉴도 권한은 그대로 살아 있다 — 목록에서 뺀 것과 문을 연 것은 다르다', () => {
  // Q&A 관리: 운영진은 통과, 원생·학부모는 막힌다(레지스트리 defaultRoles 그대로).
  assert.equal(effectiveAllowedByKey('faq', viewer('teacher'), EMPTY), true);
  assert.equal(effectiveAllowedByKey('faq', viewer('student'), EMPTY), false);
  assert.equal(effectiveAllowedByKey('faq', viewer('parent'), EMPTY), false);

  // 매트릭스로 닫을 수도 있어야 한다 — 권한 관리 툴에 계속 행으로 남는다는 뜻이다.
  const denied: PermMatrix = { faq: { teacher: false } };
  assert.equal(effectiveAllowedByKey('faq', viewer('teacher'), denied), false);
});

test('숨김 메뉴의 경로는 여전히 자기 키로 매핑된다 — 끊기면 레이아웃이 내친다', () => {
  assert.equal(resolveMenuKey('/admin/faq'), 'faq');
});

test('숨김 메뉴에 서 있으면 부모 메뉴가 켜진다', () => {
  // 관리자는 모든 숨김 화면을 여니, 모든 짝이 여기서 한 번에 검사된다.
  const menus = getAllowedMenus(viewer('admin', true), EMPTY);
  for (const node of MENU_REGISTRY.filter((n) => n.hidden)) {
    const parent = menus.find((m) => m.key === node.parentKey);
    assert.ok(parent, `${node.key}: 부모(${node.parentKey})가 사이드바에 없다`);
    assert.ok(
      parent.alsoActiveFor.includes(node.href),
      `${node.href}에 서 있는 동안 사이드바에서 아무것도 켜지지 않는다`
    );
  }
});

test('자식 권한이 없으면 숨은 경로도 딸려가지 않는다 — 부모가 열려 있어도', () => {
  // 원생은 Q&A를 보지만 편집은 못 한다. 활성 경로에 관리 화면이 섞이면
  // 사이드바가 "갈 수 있는 곳"을 잘못 말하게 된다.
  const student = getAllowedMenus(viewer('student'), EMPTY);
  assert.deepEqual(student.find((m) => m.key === 'qna')?.alsoActiveFor, []);

  // 선생님은 수업을 관리하지만 신청 현황은 admin 전용이다(권한 폭이 다른 짝).
  const teacher = getAllowedMenus(viewer('teacher'), EMPTY);
  assert.deepEqual(teacher.find((m) => m.key === 'programs')?.alsoActiveFor, []);
  assert.deepEqual(teacher.find((m) => m.key === 'gallery')?.alsoActiveFor, []);
  // 반면 Q&A 관리는 선생님의 일이다 — 같은 규칙이 여는 쪽으로도 작동해야 한다.
  assert.deepEqual(teacher.find((m) => m.key === 'qna')?.alsoActiveFor, ['/admin/faq']);
});

/* ── 레지스트리 불변식 ─────────────────────────────────────────────────── */

test('숨김 메뉴에는 반드시 진입점(부모)이 있다 — 없으면 아무도 닿을 수 없다', () => {
  for (const node of MENU_REGISTRY.filter((n) => n.hidden)) {
    assert.ok(node.parentKey, `${node.key}: 숨김 메뉴는 parentKey로 진입점을 밝혀야 한다`);
    assert.ok(getMenuNode(node.parentKey!), `${node.key}: 부모(${node.parentKey})가 레지스트리에 없다`);
  }
});
