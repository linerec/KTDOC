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
import type { MenuGroup, MenuGroupKey, MenuKey, MenuNode } from '@/types/permissions';

/**
 * 메뉴 섹션(계층 그룹) — 사이드바 소제목으로 렌더된다(표시 순서 = 이 배열 순서).
 * 비슷한 기능을 도메인별로 묶어, 받은/보내는 알림·회원 열람/운영 편집 같은 짝을 이웃에 둔다.
 * 'home'·'account'는 단독 항목이라 label ''(헤더 미표시)로 최상단·최하단에 배치한다.
 */
export const MENU_GROUPS: MenuGroup[] = [
  { key: 'home', label: '' },
  { key: 'notify', label: '알림' },
  { key: 'lesson', label: '수업 · 일정' },
  { key: 'show', label: '공연 · 참여' },
  { key: 'resource', label: '자료실' },
  { key: 'ops', label: '운영 · 설정' },
  { key: 'account', label: '' },
];

const GROUP_LABEL: Record<MenuGroupKey, string> = MENU_GROUPS.reduce(
  (acc, g) => ((acc[g.key] = g.label), acc),
  {} as Record<MenuGroupKey, string>
);

/** 그룹 소제목 조회('' = 헤더 미표시) */
export function getGroupLabel(key: MenuGroupKey): string {
  return GROUP_LABEL[key] ?? '';
}

/**
 * 네비 라벨 번역 키코드(`admin.nav.<menuKey>`).
 * AdminShell이 useT로 번역하고 없으면 등록된 한국어 label로 폴백한다.
 */
export function getMenuLabelKey(key: MenuKey): string {
  return `admin.nav.${key}`;
}

/**
 * 그룹 소제목 번역 키코드(`admin.navGroup.<groupKey>`).
 * 라벨이 빈(헤더 미표시) 그룹은 ''을 반환해 번역 대상에서 제외한다.
 */
export function getGroupLabelKey(key: MenuGroupKey): string {
  return getGroupLabel(key) ? `admin.navGroup.${key}` : '';
}

/**
 * 운영진 전용(원생·학부모에게는 보이지 않는) 메뉴 여부.
 * 사이드바 점 표시용 — 기본 노출 대상(defaultRoles)에 원생·학부모가 없으면 운영 메뉴로 본다.
 * (DB 매트릭스 오버라이드가 아니라 레지스트리의 설계 의도를 반영한다)
 */
export function isStaffOnlyMenu(node: MenuNode): boolean {
  return !node.defaultRoles.includes('student') && !node.defaultRoles.includes('parent');
}

// 레지스트리 배열 순서 = 사이드바 표시 순서. 같은 group은 반드시 연속으로 둔다
// (getAllowedMenus가 순서를 보존하므로, 그룹 헤더는 group이 바뀌는 첫 항목에서 삽입된다).
export const MENU_REGISTRY: MenuNode[] = [
  // ── 홈(대시보드): 운영진은 관리 대시보드, 원생·학부모는 마이 대시보드(알림 켜기·신청 안내)를 본다.
  { key: 'home', href: '/admin', label: '홈', iconKey: 'home', exact: true, group: 'home', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },

  // ── 알림: 받은 알림함(회원)과 보내기(운영진)를 한곳에 둔다.
  // 내 알림(받은 알림함): 운영진이 보낸 알림을 회원이 언제든 다시 보고 읽음/삭제.
  { key: 'inbox', href: '/admin/inbox', label: '내 알림', iconKey: 'inbox', group: 'notify', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  // 알림 보내기: 운영진이 원생·학부모에게 푸시 알림(전체/역할별/개인)을 발송한다.
  { key: 'notify', href: '/admin/notify', label: '알림 보내기', iconKey: 'bell', group: 'notify', defaultRoles: ['teacher', 'admin'] },

  // ── 수업 · 일정
  // 캘린더(독립): 공연·행사와 내가 참여하는 수업 일정을 월별로 한눈에. 공연/수업을 모두 아우른다.
  { key: 'schedule', href: '/admin/schedule', label: '캘린더', iconKey: 'calendar', group: 'lesson', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  // 내 수업(원생·학부모): 운영진이 배정한 수업·프로그램을 본인(학부모는 자녀별)으로 확인. 운영진은 programs에서 관리하므로 제외(admin은 항상 표시).
  { key: 'my-classes', href: '/admin/my-classes', label: '내 수업', iconKey: 'calendar', group: 'lesson', defaultRoles: ['student', 'parent'] },
  { key: 'programs', href: '/admin/programs', label: '수업 · 프로그램 관리', iconKey: 'calendar', group: 'lesson', defaultRoles: ['teacher', 'admin'] },
  // 신청 현황: '수업 · 프로그램 관리'의 하위 메뉴. 공개 신청 폼으로 들어온 신청자를 확인·응대(admin 전용).
  { key: 'applications', href: '/admin/applications', label: '신청 현황', iconKey: 'inbox', parentKey: 'programs', group: 'lesson', defaultRoles: ['admin'] },
  // 캘린더 구독 피드: 공개 .ics 피드를 켜고(이름/설명/타임존/포함범위) 구독 주소를 공유한다.
  { key: 'calendar', href: '/admin/calendar', label: '캘린더 구독', iconKey: 'calendar', group: 'lesson', defaultRoles: ['admin'] },

  // ── 공연 · 참여: 둘러보기·내 아카이브(회원)와 공연 관리·참여 집계(운영진).
  // 학생·학부모용 둘러보기(읽기 전용): 공개된 공연·행사를 검색·열람.
  { key: 'library', href: '/admin/library', label: '공연 둘러보기', iconKey: 'compass', group: 'show', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  // 내 참여 아카이브(독립): 참여한 수업과 체크인한 공연을 연도별로 모아 보여준다(참여 이력·사진).
  { key: 'archive', href: '/admin/archive', label: '내 참여 아카이브', iconKey: 'gallery', group: 'show', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  // 공연과 학내 행사(수료식·발표회)를 함께 관리한다 — 구분은 events.kind 축.
  { key: 'gallery', href: '/admin/gallery', label: '공연 · 행사 관리', iconKey: 'gallery', group: 'show', defaultRoles: ['teacher', 'admin'] },
  { key: 'gallery.photos', href: '/admin/gallery/photos', label: '사진 보관함', iconKey: 'photo', parentKey: 'gallery', group: 'show', defaultRoles: ['admin'] },
  // 공연 카테고리는 별도 메뉴/페이지 없이 '공연 관리' 페이지의 모달(버튼)에서 관리한다.
  // 참여 현황: 공연별 참가자 수·명단(체크인 집계). 운영진·관계자 검증용.
  { key: 'participation', href: '/admin/participation', label: '참여 현황', iconKey: 'calendar', group: 'show', defaultRoles: ['teacher', 'admin'] },

  // ── 자료실: Q&A 열람(회원)과 편집(운영진), 용어집·미디어·준비물 카탈로그.
  // Q&A(읽기 전용): 선생님이 미리 등록한 공통·공연별 질문/답변을 열람 — 질문하지 않아도 중요한 정보를 확인.
  { key: 'qna', href: '/admin/qna', label: 'Q&A', iconKey: 'question', group: 'resource', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
  // Q&A 관리: 공연·행사에 대해 자주 묻는 질문/답변을 선생님이 미리 등록. 회원은 'Q&A' 메뉴에서 열람.
  { key: 'faq', href: '/admin/faq', label: 'Q&A 관리', iconKey: 'question', group: 'resource', defaultRoles: ['teacher', 'admin'] },
  // 말모이(용어집): 한국 전통무용 용어·발음을 운영진이 편집. 원생·학부모는 공개 페이지(/glossary)에서 열람.
  { key: 'glossary', href: '/admin/glossary', label: '말모이 (용어집)', iconKey: 'compass', group: 'resource', defaultRoles: ['teacher', 'admin'] },
  // 뉴스·미디어: 공개 /media 페이지 게시물(소식·언론 보도·영상) 관리. 관리자와 선생님이 게시한다.
  { key: 'news', href: '/admin/news', label: '뉴스 · 미디어 관리', iconKey: 'news', group: 'resource', defaultRoles: ['teacher', 'admin'] },
  // 준비물 카탈로그: 재사용 준비물 항목을 등록하고 공연·수업 편집에서 골라 붙인다.
  { key: 'supplies', href: '/admin/supplies', label: '준비물', iconKey: 'inbox', group: 'resource', defaultRoles: ['teacher', 'admin'] },

  // ── 운영 · 설정(운영진 백오피스): 회원 관리 + 사이트 설정.
  { key: 'members', href: '/admin/members', label: '회원 관리', iconKey: 'users', group: 'ops', defaultRoles: ['teacher', 'admin'] },
  // SEO · 사이트 정보: 상호·주소·전화(NAP)·운영시간을 입력하면 푸터와 구조화 데이터(JSON-LD)에 반영된다.
  { key: 'settings.seo', href: '/admin/seo', label: 'SEO · 사이트 정보', iconKey: 'globe', group: 'ops', defaultRoles: ['admin'] },
  // AI 설정: LLM 제공자 API 키(D1 저장)·모델 목록 최신화·용도별 모델 지정. 사이트 기능들이 askAI(lib/ai)로 사용한다.
  { key: 'settings.ai', href: '/admin/ai', label: 'AI 설정', iconKey: 'spark', group: 'ops', defaultRoles: ['admin'] },
  // 권한 관리 툴: 관리자 전용 하드플로어(매트릭스로 자기 자신을 잠그는 사고 방지)
  { key: 'settings.permissions', href: '/admin/permissions', label: '권한 관리', iconKey: 'shield', requireRole: 'admin', fixed: true, group: 'ops', defaultRoles: ['admin'] },

  // ── 계정
  { key: 'profile', href: '/admin/profile', label: '내 프로필', iconKey: 'profile', group: 'account', defaultRoles: ['student', 'parent', 'teacher', 'admin'] },
];

/**
 * 폐기된 키 목록(tombstone). 삭제한 메뉴의 키를 다른 용도로 재사용하면
 * 남아있는 DB 권한 행이 의도치 않게 "부활"할 수 있으므로 재사용을 금지한다.
 */
export const RETIRED_KEYS: readonly string[] = [
  // 'library.calendar'→'schedule', 'library.archive'→'archive'로 독립 승격, 'library.my'(사진 제출)는
  // 메뉴 폐지 후 공연/수업 상세의 모달로 대체. 옛 키 재사용 금지(잔여 DB 권한 행 부활 방지).
  'library.calendar',
  'library.archive',
  'library.my',
  // 'gallery.categories': 별도 메뉴/페이지 폐지 후 '공연 관리' 페이지의 모달로 대체.
  'gallery.categories',
];

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
