import type { Session } from 'next-auth';
import type { MemberRole } from '@/types/members';
import { roleHasAnyMenu } from '@/lib/admin/menu-registry';

/**
 * 세션이 관리자(admin) 권한인지 확인.
 * 클라이언트(useSession)와 서버(auth()) 양쪽에서 동일하게 사용.
 */
export function isAdmin(session: Session | null | undefined): boolean {
  return session?.user?.role === 'admin';
}

/**
 * 세션이 운영진(선생님 또는 관리자)인지 확인.
 * 회원 승인 등 관리 작업의 접근 기준.
 */
export function isStaff(session: Session | null | undefined): boolean {
  const role = session?.user?.role;
  return role === 'teacher' || role === 'admin';
}

/**
 * 세션이 정회원(승인 완료) 상태인지 확인.
 * 승인 대기(pending)·거절(rejected)·정지(suspended)는 false.
 */
export function isApproved(session: Session | null | undefined): boolean {
  return session?.user?.status === 'active';
}

/**
 * 관리 콘솔(/admin)에 진입할 수 있는지(= ADMIN 버튼 노출 기준).
 *
 * 미들웨어 게이트(정회원 active)와 메뉴 RBAC(역할이 메뉴를 1개라도 보유)를 모두 만족해야 한다.
 * 기본 매트릭스상 admin·teacher·student·parent는 true. 역할별로 보이는 메뉴는 다르며,
 * 최종 접근 가부·착지 메뉴는 서버(app/admin/layout.tsx)가 강제한다.
 */
export function canEnterAdmin(session: Session | null | undefined): boolean {
  if (!isApproved(session)) return false;
  const role = session?.user?.role as MemberRole | undefined;
  return role ? roleHasAnyMenu(role) : false;
}
