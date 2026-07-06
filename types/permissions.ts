/**
 * 관리 콘솔 메뉴 권한(RBAC) 공용 타입
 *
 * DB 의존성이 없어 클라이언트 컴포넌트에서도 안전하게 import할 수 있다.
 * (DB 조회·강제 로직은 server 전용 lib/admin/permissions.ts 참고)
 */

import type { MemberRole } from '@/types/members';

/**
 * 메뉴 안정 식별자(href와 분리된 불변 키).
 * 라우트(href)가 바뀌어도 이 키가 유지되면 권한이 보존된다.
 * 새 메뉴를 추가하면 이 유니온과 menu-registry에 키를 더한다.
 */
export type MenuKey =
  | 'home'
  | 'inbox'
  | 'schedule'
  | 'my-classes'
  | 'programs'
  | 'applications'
  | 'glossary'
  | 'supplies'
  | 'gallery'
  | 'gallery.photos'
  | 'news'
  | 'calendar'
  | 'library'
  | 'archive'
  | 'members'
  | 'participation'
  | 'notify'
  | 'profile'
  | 'settings.permissions';

/** 메뉴 정의(코드 = 메뉴 "존재"의 진실의 원천) */
export interface MenuNode {
  key: MenuKey;
  /** 표시·라우트 매칭용 경로 (변경 가능) */
  href: string;
  label: string;
  /** 아이콘 식별자 → lib/admin/menu-icons.tsx에서 컴포넌트로 매핑 */
  iconKey: string;
  /** 서브메뉴 그룹핑(상위 메뉴 key) */
  parentKey?: MenuKey;
  /** /admin 처럼 정확히 일치할 때만 활성화 */
  exact?: boolean;
  /** DB에 권한 행이 없을 때(미설정) 적용되는 폴백. 신규 메뉴는 fail-closed로 ['admin'] 권장 */
  defaultRoles: MemberRole[];
  /** 하드플로어: DB로 바꿀 수 없는 고정 권한(예: 권한 관리 툴 = 'admin') */
  requireRole?: MemberRole;
  /** true면 매트릭스 UI에서 토글 불가(권한 툴 자기보호) */
  fixed?: boolean;
}

/** 직렬화되어 클라이언트(AdminShell)로 전달되는 네비 항목 */
export interface NavMenu {
  key: string;
  href: string;
  label: string;
  iconKey: string;
  /** 서브메뉴 들여쓰기 여부 */
  sub: boolean;
}

/** 권한 매트릭스: menu_key → (role → allowed) */
export type PermMatrix = Record<string, Partial<Record<MemberRole, boolean>>>;

/** 권한 관리 툴 셀 상태 */
export interface ToolCell {
  allowed: boolean;
  /** 토글 불가(admin 열, fixed/requireRole 메뉴) */
  locked: boolean;
  /** 명시 설정이 아니라 레지스트리 기본값에서 온 값 */
  isDefault: boolean;
}

/** 권한 관리 툴 행(메뉴 1개) */
export interface ToolRow {
  key: string;
  label: string;
  href: string;
  sub: boolean;
  fixed: boolean;
  requireRole?: MemberRole;
  cells: Record<MemberRole, ToolCell>;
}
