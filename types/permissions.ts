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
  | 'my-applications'
  | 'programs'
  | 'forms'
  | 'applications'
  | 'glossary'
  | 'supplies'
  | 'gallery'
  | 'gallery.photos'
  | 'news'
  | 'faq'
  | 'qna'
  | 'calendar'
  | 'library'
  | 'archive'
  | 'members'
  | 'participation'
  | 'resources'
  | 'notify'
  | 'profile'
  | 'settings.seo'
  | 'settings.ai'
  | 'settings.mail'
  | 'settings.permissions';

/**
 * 메뉴 섹션(계층 그룹) 식별자 — 비슷한 기능끼리 묶어 사이드바에 소제목으로 표시한다.
 * 'home'·'account'는 단독 항목이라 라벨 없이(헤더 미표시) 최상단·최하단에 둔다.
 */
export type MenuGroupKey =
  | 'home'
  | 'notify'
  | 'lesson'
  | 'show'
  | 'resource'
  | 'ops'
  | 'account';

/** 메뉴 그룹 메타(표시 순서 = 배열 순서, label '' = 헤더 미표시) */
export interface MenuGroup {
  key: MenuGroupKey;
  label: string;
}

/** 메뉴 정의(코드 = 메뉴 "존재"의 진실의 원천) */
export interface MenuNode {
  key: MenuKey;
  /** 표시·라우트 매칭용 경로 (변경 가능) */
  href: string;
  label: string;
  /** 아이콘 식별자 → lib/admin/menu-icons.tsx에서 컴포넌트로 매핑 */
  iconKey: string;
  /** 소속 섹션(계층 그룹). 같은 그룹은 레지스트리에서 연속 배치한다. */
  group: MenuGroupKey;
  /** 서브메뉴 그룹핑(상위 메뉴 key) */
  parentKey?: MenuKey;
  /**
   * 사이드바·하단바에서 감춘다(권한·라우팅은 그대로).
   * 목록에서 빼는 것이지 문을 여는 게 아니다 — 페이지는 계속 requireMenuAccess로
   * 스스로를 지키고, 권한 관리 툴에도 행으로 남는다. 진입은 parentKey 페이지 안의
   * 버튼으로 하므로 hidden 노드는 parentKey를 반드시 가진다(menuNav.test.ts).
   */
  hidden?: boolean;
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
  /**
   * 네비 라벨 번역 키코드(`admin.nav.<menuKey>`). AdminShell이 useT로 번역하고
   * 키가 없으면 label(한국어)로 폴백한다. label은 항상 폴백으로 남긴다.
   */
  labelKey: string;
  /** 서브메뉴 들여쓰기 여부 */
  sub: boolean;
  /**
   * 이 항목이 대신 켜져야 하는 경로들 — 사이드바에서 감춘(hidden) 자식 페이지.
   * 자식이 목록에 없으니, 거기 서 있는 동안 부모가 활성 표시를 넘겨받는다.
   * 자식 권한이 없는 사람에게는 빈 배열이다.
   */
  alsoActiveFor: string[];
  /** 소속 섹션 키(헤더 삽입 판정용) */
  group: MenuGroupKey;
  /** 섹션 소제목('' = 헤더 미표시) */
  groupLabel: string;
  /** 섹션 소제목 번역 키코드(`admin.navGroup.<groupKey>`, '' = 헤더 미표시) */
  groupLabelKey: string;
  /** 운영진 전용(원생·학부모에게는 보이지 않는) 메뉴 여부 — 사이드바 점 표시용 */
  staffOnly: boolean;
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
  /** 사이드바에 없는 메뉴(상위 페이지 안에서 진입) — 권한은 여기서 그대로 다룬다 */
  hidden: boolean;
  fixed: boolean;
  requireRole?: MemberRole;
  cells: Record<MemberRole, ToolCell>;
}
