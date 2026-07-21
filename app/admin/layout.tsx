/**
 * Admin Layout
 * 관리자 콘솔 공통 레이아웃 + 메뉴 권한(RBAC) 중앙 강제점.
 *
 * 강제 흐름:
 *  - 미들웨어(auth.config)가 코스 게이트(로그인+정회원) 통과 후 x-pathname 주입.
 *  - 여기서 pathname → menu_key 매핑 → 매트릭스로 접근 판정(admin은 무조건 통과).
 *  - 권한 없으면 '/'로 리다이렉트(절대 /admin 하위 금지 → 무한루프 방지).
 *  - 동일 매트릭스로 네비 메뉴를 계산해 AdminShell에 전달(보임==접근 보장).
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { resolveMenuKey } from '@/lib/admin/resolveMenuKey';
import {
  getPermMatrix,
  getAllowedMenus,
  effectiveAllowedByKey,
} from '@/lib/admin/permissions';
import type { MemberRole } from '@/types/members';
import AdminShell from '@/components/admin/AdminShell';
import { AdminThemeProvider } from '@/contexts/AdminThemeContext';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const role = (session.user.role ?? 'user') as MemberRole;
  const pathname = (await headers()).get('x-pathname');
  const menuKey = resolveMenuKey(pathname);

  // 매트릭스를 먼저 로드해 접근 판정과 네비 계산에 함께 쓴다(요청당 1회 캐시).
  // 원격 DB 일시 장애로 로드가 실패해도 콘솔이 깨지지 않도록 빈 매트릭스로 폴백한다
  // (레지스트리 defaultRoles로 판정 — admin은 무조건 통과).
  const matrix = await getPermMatrix().catch((err) => {
    console.error('권한 매트릭스 로드 실패 — 기본 권한으로 폴백:', err);
    return {} as Awaited<ReturnType<typeof getPermMatrix>>;
  });
  const menus = getAllowedMenus(role, matrix);

  // 현재 경로 메뉴 접근 강제(admin은 무조건 통과).
  // - 권한이 없으면 '/'로 내치지 않고 이 역할이 볼 수 있는 "첫 허용 메뉴"로 보낸다.
  //   콘솔 진입점(/admin=home) 권한이 없는 원생·학부모도 둘러보기 등 본인 메뉴로 착지한다.
  // - 허용 메뉴가 하나도 없으면 '/'. menus[0]은 항상 접근 가능한 경로라 리다이렉트 루프가 없다.
  // - 미매핑 경로(레지스트리 미등록)는 fail-closed: 관리자 외에는 접근 메뉴로 보낸다.
  if (role !== 'admin') {
    const allowed = menuKey
      ? effectiveAllowedByKey(menuKey, role, matrix)
      : false;
    if (!allowed) {
      redirect(menus[0]?.href ?? '/');
    }
  }

  const userName =
    session.user?.name || session.user?.email?.split('@')[0] || '관리자';

  // 멤버(원생·학부모)에게는 "관리 콘솔" 대신 친근한 "마이페이지" 톤으로.
  // 라벨은 클라이언트(AdminShell)에서 useT로 번역하고, 키가 없으면 이 한국어로 폴백한다.
  const isMember = role === 'student' || role === 'parent';
  const consoleLabel = isMember ? '마이페이지' : '관리 콘솔';
  const consoleLabelKey = isMember ? 'admin.shell.consoleMember' : 'admin.shell.console';

  // 운영진(선생님·관리자)에게만 '운영진 전용' 점을 노출한다.
  // 원생·학부모는 보이는 게 곧 본인 메뉴라 점이 의미 없고 혼란만 준다.
  const showStaffMarks = role === 'teacher' || role === 'admin';

  return (
    <AdminThemeProvider>
      <AdminShell
        userName={userName}
        menus={menus}
        consoleLabel={consoleLabel}
        consoleLabelKey={consoleLabelKey}
        showStaffMarks={showStaffMarks}
      >
        {children}
      </AdminShell>
    </AdminThemeProvider>
  );
}
