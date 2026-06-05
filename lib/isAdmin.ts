import type { Session } from 'next-auth';

/**
 * 세션이 관리자(admin) 권한인지 확인.
 * 클라이언트(useSession)와 서버(auth()) 양쪽에서 동일하게 사용.
 */
export function isAdmin(session: Session | null | undefined): boolean {
  return session?.user?.role === 'admin';
}
