/**
 * 메뉴 권한(RBAC) 서버 로직 — server-only (lib/db 사용)
 *
 * 평가 순서(고정):
 *   1) role === 'admin'        → 무조건 허용 (락아웃·DB장애 면역)
 *   2) node.requireRole        → role === requireRole (하드플로어, DB로 못 바꿈)
 *   3) DB에 menu_key 행 존재    → 그 (menu_key, role) allowed 값
 *   4) 미설정(행 없음)          → 레지스트리 defaultRoles
 *
 * 클라이언트에서 import 금지(이 파일은 DB에 접근한다). 타입만 필요하면 types/permissions.ts.
 */

import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { query } from '@/lib/db';
import {
  MENU_REGISTRY,
  getMenuNode,
  isKnownMenuKey,
} from '@/lib/admin/menu-registry';
import { MEMBER_ROLES, type MemberRole } from '@/types/members';
import type {
  MenuKey,
  MenuNode,
  NavMenu,
  PermMatrix,
  ToolRow,
  ToolCell,
} from '@/types/permissions';

// 역할 목록의 단일 출처는 types/members.ts의 MEMBER_ROLES (별도 배열 중복 방지)
const ALL_ROLES: MemberRole[] = MEMBER_ROLES;

/**
 * 권한 매트릭스 로드. React.cache로 요청당 1회만 DB 조회(중복 제거).
 * 테이블이 작아(≤수십 행) 요청마다 신선하게 읽으므로 저장 직후 즉시 반영된다.
 */
export const getPermMatrix = cache(async (): Promise<PermMatrix> => {
  const rows = await query<{ menu_key: string; role: MemberRole; allowed: number }[]>(
    'SELECT menu_key, role, allowed FROM menu_permissions'
  );
  const matrix: PermMatrix = {};
  for (const r of rows) {
    (matrix[r.menu_key] ||= {})[r.role] = r.allowed === 1;
  }
  return matrix;
});

/** 단일 메뉴 노드에 대한 역할 허용 판정 */
export function effectiveAllowed(
  node: MenuNode,
  role: MemberRole,
  matrix: PermMatrix
): boolean {
  if (role === 'admin') return true;
  if (node.requireRole) return role === node.requireRole;
  const rows = matrix[node.key];
  // 이 역할의 명시 행이 있으면 그 값, 없으면(미설정/신규 역할) defaultRoles 폴백
  if (rows && role in rows) return rows[role] === true;
  return node.defaultRoles.includes(role);
}

/** menu_key 문자열 기준 판정(미매핑/고아 키는 fail-closed = admin만) */
export function effectiveAllowedByKey(
  key: string | null,
  role: MemberRole,
  matrix: PermMatrix
): boolean {
  if (role === 'admin') return true;
  if (!key) return false;
  const node = getMenuNode(key);
  if (!node) return false;
  return effectiveAllowed(node, role, matrix);
}

/** 역할이 볼 수 있는 네비 메뉴(직렬화 가능) */
export function getAllowedMenus(role: MemberRole, matrix: PermMatrix): NavMenu[] {
  return MENU_REGISTRY.filter((node) => effectiveAllowed(node, role, matrix)).map(
    (node) => ({
      key: node.key,
      href: node.href,
      label: node.label,
      iconKey: node.iconKey,
      sub: !!node.parentKey,
    })
  );
}

/**
 * 메뉴 접근 강제. 권한 없으면 redirect (절대 /admin 하위로 보내지 않음 → 무한루프 방지).
 * admin은 DB 조회 없이 통과(DB 장애·락아웃 면역).
 */
export async function requireMenuAccess(
  session: Session | null,
  key: MenuKey | null
): Promise<void> {
  if (!session?.user) redirect('/login');
  const role = (session.user.role ?? 'user') as MemberRole;
  if (role === 'admin') return;
  const matrix = await getPermMatrix();
  if (!effectiveAllowedByKey(key, role, matrix)) redirect('/');
}

/* ------------------------------------------------------------------ */
/* 권한 관리 툴용                                                       */
/* ------------------------------------------------------------------ */

/** 매트릭스 UI에 넘길 행 목록(메뉴별 5역할 셀 상태) */
export function buildToolMatrix(matrix: PermMatrix): ToolRow[] {
  return MENU_REGISTRY.map((node) => {
    const rows = matrix[node.key];
    const cells = {} as Record<MemberRole, ToolCell>;
    for (const role of ALL_ROLES) {
      // admin 열, fixed 메뉴, requireRole 메뉴는 토글 불가
      const locked =
        role === 'admin' || !!node.fixed || !!node.requireRole;
      const hasRow = !!rows && role in rows;
      let allowed: boolean;
      if (role === 'admin') allowed = true;
      else if (node.requireRole) allowed = role === node.requireRole;
      else if (hasRow) allowed = rows![role] === true;
      else allowed = node.defaultRoles.includes(role);
      cells[role] = {
        allowed,
        locked,
        // 명시 행이 아니라 레지스트리 기본값에서 온 값인지(역할별)
        isDefault: !hasRow && !node.requireRole,
      };
    }
    return {
      key: node.key,
      label: node.label,
      href: node.href,
      sub: !!node.parentKey,
      fixed: !!node.fixed,
      requireRole: node.requireRole,
      cells,
    };
  });
}

/** 레지스트리에 없는 DB 잔여(고아) 메뉴 키 */
export async function listOrphanKeys(): Promise<string[]> {
  const rows = await query<{ menu_key: string }[]>(
    'SELECT DISTINCT menu_key FROM menu_permissions'
  );
  return rows.map((r) => r.menu_key).filter((k) => !isKnownMenuKey(k));
}

/**
 * 매트릭스 저장(전체 덮어쓰기). 보안 불변식을 서버에서 강제한다:
 *  - admin 행은 무조건 allowed=1 (락아웃 방지)
 *  - fixed/requireRole 메뉴(권한 툴)는 DB로 못 바꿈 → 건너뜀
 *  - 레지스트리에 없는 키는 무시(클라 payload 불신)
 */
export async function savePermissions(
  desired: { menu_key: string; role: MemberRole; allowed: boolean }[],
  actorId: string
): Promise<void> {
  const want = new Map<string, boolean>();
  for (const d of desired) want.set(`${d.menu_key}:${d.role}`, d.allowed);

  const values: string[] = [];
  const params: unknown[] = [];

  for (const node of MENU_REGISTRY) {
    if (node.fixed || node.requireRole) continue; // 잠긴 메뉴
    for (const role of ALL_ROLES) {
      let allowed: boolean;
      if (role === 'admin') {
        allowed = true; // 락아웃 방지
      } else if (want.has(`${node.key}:${role}`)) {
        allowed = want.get(`${node.key}:${role}`)!;
      } else {
        allowed = node.defaultRoles.includes(role);
      }
      values.push('(?, ?, ?, ?)');
      params.push(node.key, role, allowed ? 1 : 0, actorId);
    }
  }

  if (!values.length) return;
  await query(
    `INSERT INTO menu_permissions (menu_key, role, allowed, updated_by)
     VALUES ${values.join(', ')}
     ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_by = VALUES(updated_by)`,
    params
  );
}

/** 고아 메뉴 키의 DB 행 정리(레지스트리에 있는 키는 거부) */
export async function deleteOrphanKey(menuKey: string): Promise<boolean> {
  if (isKnownMenuKey(menuKey)) return false;
  await query('DELETE FROM menu_permissions WHERE menu_key = ?', [menuKey]);
  return true;
}
