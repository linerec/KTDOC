import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ForcePasswordForm from '@/components/auth/ForcePasswordForm';

export const metadata: Metadata = {
  title: '새 비밀번호 설정 - KTDOC',
};

/**
 * 임시 비밀번호로 로그인한 회원의 새 비밀번호 설정 페이지.
 * 미들웨어(auth.config authorized)가 mustChangePassword 회원을 모든 경로에서
 * 이곳으로 보낸다. 승인 대기(pending) 회원도 로그인은 가능하므로
 * /admin 밖(공개 auth 레이아웃)에 둔다.
 */
export default async function ForcePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!session.user.mustChangePassword) {
    redirect(session.user.status === 'active' ? '/admin' : '/');
  }
  return <ForcePasswordForm />;
}
