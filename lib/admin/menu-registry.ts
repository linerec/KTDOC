/**
 * 관리 콘솔 메뉴 레지스트리 — 메뉴 "존재"의 진실의 원천(SSOT)
 *
 * 메뉴의 라우트·라벨·아이콘·계층·기본권한을 한 곳에서 정의한다.
 * 권한 "값"은 DB(menu_permissions)에서 admin이 토글하며, 여기 defaultRoles는
 * DB에 행이 없을 때(미설정)의 폴백이다.
 *
 * 메뉴 추가  = 이 배열에 노드 1개 추가 + types/permissions.ts MenuKey 유니온에 키 추가.
 *             (DB 마이그레이션 불필요. defaultRoles로 즉시 안전하게 동작)
 * 메뉴 삭제  = 노드 제거. DB의 해당 행은 고아가 되지만 런타임은 레지스트리만 순회하므로 무시된다.
 *             (권한 관리 툴의 "사용하지 않는 메뉴"에서 수동 정리)
 *
 * DB 의존성이 없어 서버/클라이언트 어디서나 import 가능하다.
 */

import type { MemberRole } from '@/types/members';
import type { MenuNode } from '@/types/permissions';

export const MENU_REGISTRY: MenuNode[] = [
  // 홈(대시보드): 운영진은 관리 대시보드, 원생·학부모는 마이 대시보드(알림 켜기·신청 안내)를 본다.
  { key: 'home', href: '/admin', label: '홈', iconKey: 'home', exact: true, defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  // 내 알림(받은 알림함): 운영진이 보낸 알림을 회원이 언제든 다시 보고 읽음/삭제.
  { key: 'inbox', href: '/admin/inbox', label: '내 알림', iconKey: 'inbox', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  { key: 'programs', href: '/admin/programs', label: '수업 · 프로그램', iconKey: 'calendar', defaultRoles: ['admin'] },
  { key: 'applications', href: '/admin/applications', label: '신청 현황', iconKey: 'inbox', defaultRoles: ['admin'] },
  { key: 'gallery', href: '/admin/gallery', label: '이벤트 아카이브 관리', iconKey: 'gallery', defaultRoles: ['admin'] },
  { key: 'gallery.photos', href: '/admin/gallery/photos', label: '사진 보관함', iconKey: 'photo', parentKey: 'gallery', defaultRoles: ['admin'] },
  { key: 'gallery.categories', href: '/admin/gallery/categories', label: '이벤트 카테고리', iconKey: 'tag', parentKey: 'gallery', defaultRoles: ['admin'] },
  // 캘린더 구독 피드: 공개 .ics 피드를 켜고(이름/설명/타임존/포함범위) 구독 주소를 공유한다.
  { key: 'calendar', href: '/admin/calendar', label: '캘린더 구독', iconKey: 'calendar', defaultRoles: ['admin'] },
  // 학생·학부모용 둘러보기(읽기 전용): 공개된 이벤트(공연·행사)를 검색·열람.
  { key: 'library', href: '/admin/library', label: '이벤트 둘러보기', iconKey: 'compass', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  // 캘린더: 다가오는/지난 이벤트를 월별로 한눈에. 내가 참여하는 이벤트 강조.
  { key: 'library.calendar', href: '/admin/library/calendar', label: '캘린더', iconKey: 'calendar', parentKey: 'library', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  // 내 참여 아카이브: 체크인한 이벤트를 연도별로 모아 보여준다(참여 이력·사진).
  { key: 'library.archive', href: '/admin/library/archive', label: '내 참여 아카이브', iconKey: 'gallery', parentKey: 'library', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  // 내 사진 제출: 학생·학부모가 본인 사진을 올리면 보관함으로 들어가 운영진 검토 후 공개된다.
  { key: 'library.my', href: '/admin/library/my', label: '내 사진 · 제출', iconKey: 'photo', parentKey: 'library', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  { key: 'members', href: '/admin/members', label: '회원 관리', iconKey: 'users', defaultRoles: ['teacher', 'admin'] },
  // 참여 현황: 이벤트별 참가자 수·명단(체크인 집계). 운영진·관계자 검증용.
  { key: 'participation', href: '/admin/participation', label: '참여 현황', iconKey: 'calendar', defaultRoles: ['teacher', 'admin'] },
  // 알림 보내기: 운영진이 원생·학부모에게 푸시 알림(전체/역할별/개인)을 발송한다.
  { key: 'notify', href: '/admin/notify', label: '알림 보내기', iconKey: 'bell', defaultRoles: ['teacher', 'admin'] },
  { key: 'profile', href: '/admin/profile', label: '내 프로필', iconKey: 'profile', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  // 권한 관리 툴: 관리자 전용 하드플로어(매트릭스로 자기 자신을 잠그는 사고 방지)
  { key: 'settings.permissions', href: '/admin/permissions', label: '권한 관리', iconKey: 'shield', requireRole: 'admin', fixed: true, defaultRoles: ['admin'] },
];

/**
 * 폐기된 키 목록(tombstone). 삭제한 메뉴의 키를 다른 용도로 재사용하면
 * 남아있는 DB 권한 행이 의도치 않게 "부활"할 수 있으므로 재사용을 금지한다.
 */
export const RETIRED_KEYS: readonly string[] = [];

export function getMenuNode(key: string): MenuNode | undefined {
  return MENU_REGISTRY.find((m) => m.key === key);
}

/**
 * 역할이 기본(defaultRoles/requireRole) 기준으로 접근 가능한 메뉴를 1개라도 갖는지.
 *
 * 클라이언트(헤더 ADMIN 버튼 노출)용 휴리스틱이다. DB 매트릭스 오버라이드는
 * 반영하지 않으므로 최종 접근 가부는 서버(app/admin/layout.tsx)가 강제한다.
 * 기본값상 admin·teacher·student·parent는 true, 레거시 'user'는 false.
 */
export function roleHasAnyMenu(role: MemberRole): boolean {
  return MENU_REGISTRY.some((node) =>
    node.requireRole ? role === node.requireRole : node.defaultRoles.includes(role)
  );
}

/** 레지스트리에 존재하는 키 집합(고아 키 판정용) */
export function isKnownMenuKey(key: string): boolean {
  return MENU_REGISTRY.some((m) => m.key === key);
}
