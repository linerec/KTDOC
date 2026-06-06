/**
 * Admin Layout
 * 관리자 페이지 공통 레이아웃 — 전용 셸(사이드바/드로어 메뉴)로 감싼다.
 */

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
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

  // 로그인하지 않은 사용자는 로그인 페이지로, 로그인했으나 관리자가 아니면 홈으로
  if (!session) {
    redirect('/login');
  }
  if (!isAdmin(session)) {
    redirect('/');
  }

  const userName =
    session.user?.name || session.user?.email?.split('@')[0] || '관리자';

  return <AdminShell userName={userName}>{children}</AdminShell>;
}
