/**
 * 메뉴 권한(RBAC) 서버 로직 — server-only (lib/db 사용)
 *
 * 평가 순서(고정):
 *   1) 관리 권한(is_admin)      → 무조건 허용 (락아웃·DB장애 면역)
 *   2) node.requireRole        → role === requireRole (하드플로어, DB로 못 바꿈)
 *   3) DB에 menu_key 행 존재    → 그 (menu_key, role) allowed 값
 *   4) 미설정(행 없음)          → 레지스트리 defaultRoles
 *
 * 1)이 신분이 아니라 **플래그**를 본다는 점이 핵심이다(0034). 그래서 선생님이
 * 관리 권한을 받아도 선생님 메뉴를 잃지 않는다 — 신분으로 열리는 메뉴에
 * 관리 메뉴가 더해질 뿐이다. 매트릭스의 열은 신분뿐이고 'admin' 열은 없다.
 *
 * 클라이언트에서 import 금지(이 파일은 DB에 접근한다). 타입만 필요하면 types/permissions.ts.
 */

import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { query } from '@/lib/db';
import {
  MENU_REGISTRY,
  getGroupLabel,
  getGroupLabelKey,
  getMenuLabelKey,
  isKnownMenuKey,
  isStaffOnlyMenu,
} from '@/lib/admin/menu-registry';
import {
  viewerOf,
  effectiveAllowed,
  effectiveAllowedByKey,
  type MenuViewer,
} from '@/lib/admin/menuAccess';
import { MEMBER_ROLES, type MemberRole } from '@/types/members';
import type {
  MenuKey,
  NavMenu,
  PermMatrix,
  ToolRow,
  ToolCell,
} from '@/types/permissions';

// 신분 목록의 단일 출처는 types/members.ts의 MEMBER_ROLES (별도 배열 중복 방지).
// 레거시 'admin'은 여기 없다 — 관리 권한은 열이 아니라 플래그다.
const ALL_ROLES: MemberRole[] = MEMBER_ROLES;

// 판정 자체는 순수 모듈(menuAccess)에 있다 — 여기서 재수출해 호출부는 그대로 둔다.
export { viewerOf, effectiveAllowed, effectiveAllowedByKey };
export type { MenuViewer };

/**
 * 프로세스 단위 TTL 캐시.
 * admin 진입마다 원격 MySQL(us-east-2 RDS, 왕복 100ms+)을 치지 않도록 짧은 시간
 * 매트릭스를 메모리에 들고 있는다. 권한 저장/삭제 시 즉시 무효화하므로 저장한
 * 인스턴스는 바로 신선한 값을 본다(다른 인스턴스는 최대 TTL 동안 지연).
 */
const PERM_CACHE_TTL_MS = 30_000;
let permCache: { matrix: PermMatrix; expires: number } | null = null;

/** 권한 매트릭스 캐시 무효화 — 권한 저장/삭제 직후 호출. */
export function invalidatePermMatrix(): void {
  permCache = null;
}

async function loadPermMatrix(): Promise<PermMatrix> {
  const rows = await query<{ menu_key: string; role: MemberRole; allowed: number }[]>(
    'SELECT menu_key, role, allowed FROM menu_permissions'
  );
  const matrix: PermMatrix = {};
  for (const r of rows) {
    (matrix[r.menu_key] ||= {})[r.role] = r.allowed === 1;
  }
  return matrix;
}

/**
 * 권한 매트릭스 로드. 두 겹 캐시로 admin 진입 지연을 줄인다.
 *  - React.cache: 같은 요청 내 중복 조회 제거.
 *  - 프로세스 TTL 캐시(30s): 진입마다의 원격 DB 왕복 제거.
 * DB 조회가 실패하면 stale 캐시라도 반환해 화면이 깨지지 않게 한다
 * (캐시가 전혀 없으면 throw → 레이아웃이 기본 권한으로 폴백).
 */
export const getPermMatrix = cache(async (): Promise<PermMatrix> => {
  const now = Date.now();
  if (permCache && permCache.expires > now) return permCache.matrix;
  try {
    const matrix = await loadPermMatrix();
    permCache = { matrix, expires: now + PERM_CACHE_TTL_MS };
    return matrix;
  } catch (err) {
    if (permCache) {
      console.error('권한 매트릭스 갱신 실패 — stale 캐시 사용:', err);
      return permCache.matrix;
    }
    throw err;
  }
});

/** 주체가 볼 수 있는 네비 메뉴(직렬화 가능) */
export function getAllowedMenus(viewer: MenuViewer, matrix: PermMatrix): NavMenu[] {
  return MENU_REGISTRY.filter((node) => effectiveAllowed(node, viewer, matrix)).map(
    (node) => ({
      key: node.key,
      href: node.href,
      label: node.label,
      labelKey: getMenuLabelKey(node.key),
      iconKey: node.iconKey,
      sub: !!node.parentKey,
      group: node.group,
      groupLabel: getGroupLabel(node.group),
      groupLabelKey: getGroupLabelKey(node.group),
      staffOnly: isStaffOnlyMenu(node),
    })
  );
}

/**
 * 메뉴 접근 강제. 권한 없으면 redirect (절대 /admin 하위로 보내지 않음 → 무한루프 방지).
 * 관리 권한자는 DB 조회 없이 통과(DB 장애·락아웃 면역).
 */
export async function requireMenuAccess(
  session: Session | null,
  key: MenuKey | null
): Promise<void> {
  if (!session?.user) redirect('/login');
  const viewer = viewerOf(session);
  if (viewer.isAdmin) return;
  const matrix = await getPermMatrix();
  if (!effectiveAllowedByKey(key, viewer, matrix)) redirect('/');
}

/**
 * API 라우트용 메뉴 접근 판정(redirect 없이 boolean 반환).
 * 페이지는 requireMenuAccess, JSON 응답을 돌려줘야 하는 API는 이 함수를 쓴다.
 * 관리 권한자는 DB 조회 없이 통과, 나머지는 정회원(active) + 매트릭스 판정.
 */
export async function hasMenuAccess(
  session: Session | null,
  key: MenuKey
): Promise<boolean> {
  if (!session?.user) return false;
  const viewer = viewerOf(session);
  if (viewer.isAdmin) return true;
  if (session.user.status !== 'active') return false;
  const matrix = await getPermMatrix().catch(() => ({}) as PermMatrix);
  return effectiveAllowedByKey(key, viewer, matrix);
}

/* ------------------------------------------------------------------ */
/* 권한 관리 툴용                                                       */
/* ------------------------------------------------------------------ */

/**
 * 매트릭스 UI에 넘길 행 목록(메뉴별 신분 셀 상태).
 * 관리 권한은 열이 아니므로 여기 없다 — 플래그를 가진 사람은 어차피 전부 통과한다.
 */
export function buildToolMatrix(matrix: PermMatrix): ToolRow[] {
  return MENU_REGISTRY.map((node) => {
    const rows = matrix[node.key];
    const cells = {} as Record<MemberRole, ToolCell>;
    for (const role of ALL_ROLES) {
      // fixed 메뉴, requireRole 메뉴는 토글 불가
      const locked = !!node.fixed || !!node.requireRole;
      const hasRow = !!rows && role in rows;
      let allowed: boolean;
      if (node.requireRole) allowed = role === node.requireRole;
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
 *  - fixed/requireRole 메뉴(권한 툴)는 DB로 못 바꿈 → 건너뜀
 *  - 레지스트리에 없는 키는 무시(클라 payload 불신)
 *
 * 예전에는 'admin' 행을 무조건 1로 박아 락아웃을 막았다. 이제 관리 권한이
 * 매트릭스 밖(플래그)에 있으므로 매트릭스를 어떻게 저장하든 관리자가 자기
 * 콘솔에서 잠길 수 없다 — 그 방어는 구조가 대신한다.
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
      if (want.has(`${node.key}:${role}`)) {
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
  invalidatePermMatrix(); // 저장 즉시 반영
}

/** 고아 메뉴 키의 DB 행 정리(레지스트리에 있는 키는 거부) */
export async function deleteOrphanKey(menuKey: string): Promise<boolean> {
  if (isKnownMenuKey(menuKey)) return false;
  await query('DELETE FROM menu_permissions WHERE menu_key = ?', [menuKey]);
  invalidatePermMatrix(); // 삭제 즉시 반영
  return true;
}
