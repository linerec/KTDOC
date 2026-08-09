import type { Session } from 'next-auth';
import type { MemberRole } from '@/types/members';
import { roleHasAnyMenu } from '@/lib/admin/menu-registry';

/**
 * 세션이 관리 권한을 가졌는지 확인.
 * 클라이언트(useSession)와 서버(auth()) 양쪽에서 동일하게 사용.
 *
 * 관리 권한은 **신분(role)과 별개인 플래그**다(0034). 그래서 선생님이면서
 * 관리자, 원생이면서 관리자가 성립한다. 이 함수의 겉모습은 분리 전과 같으므로
 * 호출부(60여 곳)는 그대로 두어도 뜻이 어긋나지 않는다 — "관리 권한이 있는가".
 */
export function isAdmin(session: Session | null | undefined): boolean {
  return session?.user?.isAdmin === true;
}

/**
 * 본인 이름으로 행사에 참여 체크인할 수 있는지.
 *
 * 선생님도 무대에 서고 관리자도 행사에 나간다. 원생만 참여자로 보면 운영진의
 * 참여 기록이 통째로 빠지고, 명단이 실제와 어긋난다.
 *
 * 학부모는 false다 — 본인이 아니라 자녀를 대신 체크인하며, 그 경로는
 * ParentCheckin이 따로 맡는다.
 */
export function canSelfCheckIn(session: Session | null | undefined): boolean {
  const role = session?.user?.role;
  return role === 'student' || role === 'teacher' || isAdmin(session);
}

/**
 * 세션이 운영진인지 확인 — 신분이 선생님이거나, 관리 권한을 가진 사람.
 * 회원 승인 등 관리 작업의 접근 기준.
 *
 * 원생이 관리 권한을 받으면 여기서도 true다. 권한을 준 이상 그 일을 할 수
 * 있어야 하고, 신분이 무엇인지는 이 판정과 상관없다.
 */
export function isStaff(session: Session | null | undefined): boolean {
  return session?.user?.role === 'teacher' || isAdmin(session);
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
 * 미들웨어 게이트(정회원 active)와 메뉴 RBAC(신분이 메뉴를 1개라도 보유)를 모두 만족해야 한다.
 * 기본 매트릭스상 teacher·student·parent는 true. 신분별로 보이는 메뉴는 다르며,
 * 최종 접근 가부·착지 메뉴는 서버(app/admin/layout.tsx)가 강제한다.
 *
 * 관리 권한을 가진 사람은 신분을 보지 않고 통과시킨다 — 운영 계정(staff)은
 * 신분만으로는 볼 메뉴가 하나도 없어서, 플래그를 보지 않으면 자기 콘솔에 못 들어간다.
 */
export function canEnterAdmin(session: Session | null | undefined): boolean {
  if (!isApproved(session)) return false;
  if (isAdmin(session)) return true;
  const role = session?.user?.role as MemberRole | undefined;
  return role ? roleHasAnyMenu(role) : false;
}
