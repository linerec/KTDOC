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
  requireMenuAccess,
} from '@/lib/admin/permissions';
import type { MemberRole } from '@/types/members';
import AdminShell from '@/components/admin/AdminShell';

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

  // 현재 경로 메뉴 접근 강제(권한 없으면 '/'로 리다이렉트).
  // - 메뉴 키가 해석되면 매트릭스로 강제(중앙 방어).
  // - 해석 불가(레지스트리 미등록 경로 등)면 fail-closed: 관리자만 통과,
  //   그 외 역할은 차단한다(가드 누락된 신규 페이지가 노출되지 않도록).
  if (menuKey) {
    await requireMenuAccess(session, menuKey);
  } else if (role !== 'admin') {
    redirect('/');
  }

  // 네비 메뉴 계산(요청당 캐시된 매트릭스 재사용 → 추가 쿼리 없음)
  const matrix = await getPermMatrix();
  const menus = getAllowedMenus(role, matrix);

  const userName =
    session.user?.name || session.user?.email?.split('@')[0] || '관리자';

  return (
    <AdminShell userName={userName} menus={menus}>
      {children}
    </AdminShell>
  );
}
