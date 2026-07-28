/**
 * /app — 홈 화면 아이콘(PWA)의 진입점
 *
 * 매니페스트 start_url이 가리키는 유일한 주소다. UI 없이 세션 상태만 보고 보낸다.
 *   세션 없음          → 로그인(끝나면 대시보드로 복귀)
 *   세션 있음 · 승인대기 → 공개 홈
 *   세션 있음 · 정회원   → 대시보드
 *
 * /admin을 start_url로 직접 쓰지 않는 이유: iOS는 홈 화면에 추가하는 순간
 * start_url을 아이콘에 각인한다. 착지 지점을 나중에 바꾸려면 매니페스트 수정만으로는
 * 안 되고 회원 전원이 재설치해야 한다. 바뀌지 않는 주소를 하나 두고 분기는 여기서 한다.
 *
 * 임시 비밀번호 강제 변경은 미들웨어(auth.config)가 이 페이지보다 먼저 가로챈다.
 */

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'KTDOC',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AppEntryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/admin')}`);
  }
  if (session.user.status !== 'active') {
    redirect('/');
  }
  redirect('/admin');
}
