import type { Session } from 'next-auth';

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
