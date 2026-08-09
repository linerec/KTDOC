/**
 * 메뉴 접근 판정 — 순수 로직
 *
 * DB도 리다이렉트도 모르는 순수 함수만 둔다. 부수효과가 붙은 쪽(매트릭스 로드,
 * requireMenuAccess의 redirect)은 lib/admin/permissions.ts다. 나눠 둔 이유는
 * 하나뿐이다: **판정을 시험할 수 있어야 한다**(lib/admin/permissions.test.ts).
 *
 * 평가 순서(고정):
 *   1) 관리 권한(is_admin)      → 무조건 허용 (락아웃·DB장애 면역)
 *   2) node.requireRole        → role === requireRole (하드플로어, DB로 못 바꿈)
 *   3) DB에 menu_key 행 존재    → 그 (menu_key, role) allowed 값
 *   4) 미설정(행 없음)          → 레지스트리 defaultRoles
 *
 * 1)이 신분이 아니라 **플래그**를 본다는 점이 이 파일의 핵심이다(0034). 그래서
 * 선생님이 관리 권한을 받아도 선생님 메뉴를 잃지 않는다 — 신분으로 열리는 메뉴에
 * 관리 메뉴가 더해질 뿐이다.
 */

// node --test가 별칭(@/)을 풀지 못하므로 상대 경로로 쓴다 — 이 파일은 시험 대상이다.
import type { Session } from 'next-auth';
import { getMenuNode } from './menu-registry.ts';
import type { MemberRole } from '../../types/members.ts';
import type { MenuNode, PermMatrix } from '../../types/permissions.ts';

/**
 * 메뉴를 보는 주체 — 신분과 관리 권한을 함께 들고 다닌다.
 * 판정에 둘 다 필요하므로 인자를 늘리는 대신 한 덩어리로 넘긴다.
 */
export interface MenuViewer {
  role: MemberRole;
  isAdmin: boolean;
}

/** 세션에서 주체를 뽑는다(신분이 없으면 레거시 'user'로 본다). */
export function viewerOf(session: Session | null | undefined): MenuViewer {
  return {
    role: (session?.user?.role ?? 'user') as MemberRole,
    isAdmin: session?.user?.isAdmin === true,
  };
}

/** 단일 메뉴 노드에 대한 허용 판정 */
export function effectiveAllowed(
  node: MenuNode,
  viewer: MenuViewer,
  matrix: PermMatrix
): boolean {
  if (viewer.isAdmin) return true;
  const { role } = viewer;
  if (node.requireRole) return role === node.requireRole;
  const rows = matrix[node.key];
  // 이 신분의 명시 행이 있으면 그 값, 없으면(미설정/신규 신분) defaultRoles 폴백
  if (rows && role in rows) return rows[role] === true;
  return node.defaultRoles.includes(role);
}

/** menu_key 문자열 기준 판정(미매핑/고아 키는 fail-closed = 관리 권한자만) */
export function effectiveAllowedByKey(
  key: string | null,
  viewer: MenuViewer,
  matrix: PermMatrix
): boolean {
  if (viewer.isAdmin) return true;
  if (!key) return false;
  const node = getMenuNode(key);
  if (!node) return false;
  return effectiveAllowed(node, viewer, matrix);
}
