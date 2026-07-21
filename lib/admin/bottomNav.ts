/**
 * 모바일 하단 탭바 — '핵심 페이지 직행' 슬롯 선정
 *
 * 하단 바는 (직행 탭 N개) + (더보기) 구조다. 여기서는 역할이 볼 수 있는 메뉴
 * (getAllowedMenus 결과) 중 하단 바에 바로 올릴 핵심 페이지 N개를 고른다.
 *
 * 우선순위는 원생·학부모(웹앱 주 사용자) 기준으로 짰다. 상위 키부터 훑어
 * 해당 역할이 접근 가능한 것만 최대 N개 담고, 부족하면 나머지 메뉴 순서대로 채운다.
 * 나머지(관리 페이지 등)는 '더보기' 시트에서 전부 노출되므로 도달 불가 메뉴는 없다.
 */

import type { NavMenu } from '@/types/permissions';

/** 하단 직행 슬롯 우선순위(menu key). 앞쪽일수록 먼저 채워진다. */
export const BOTTOM_NAV_PRIORITY: readonly string[] = [
  'home', // 홈(대시보드)
  'schedule', // 캘린더 — 모든 역할
  'library', // 공연 둘러보기 — 모든 역할
  'inbox', // 내 알림 — 모든 역할
  'archive', // 내 참여 아카이브
  'qna', // Q&A
  'my-classes', // 내 수업(원생·학부모)
  'gallery', // 공연 관리(운영진)
  'programs', // 수업·프로그램 관리(운영진)
  'members', // 회원 관리(운영진)
  'profile', // 내 프로필
];

/** 하단 바의 직행 탭 후보를 우선순위대로 최대 max개 고른다(도달 가능한 메뉴만). */
export function pickBottomNav(menus: NavMenu[], max = 4): NavMenu[] {
  const byKey = new Map(menus.map((m) => [m.key, m]));
  const picked: NavMenu[] = [];

  for (const key of BOTTOM_NAV_PRIORITY) {
    const m = byKey.get(key);
    if (m && !picked.includes(m)) {
      picked.push(m);
      if (picked.length >= max) return picked;
    }
  }
  // 우선순위 목록만으로 부족하면 남은 메뉴로 채운다(순서 보존).
  for (const m of menus) {
    if (picked.length >= max) break;
    if (!picked.includes(m)) picked.push(m);
  }
  return picked;
}
