import type { NextAuthConfig } from 'next-auth';
import { NextResponse } from 'next/server';

export const authConfig: NextAuthConfig = {
  providers: [], // Providers will be added in auth.ts
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth, request }) {
      const { nextUrl } = request;
      const isLoggedIn = !!auth?.user;
      const status = auth?.user?.status;
      const pathname = nextUrl.pathname;

      const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
      const isAdminRoute = pathname.startsWith('/admin');
      const isProtectedRoute = isAdminRoute || pathname.startsWith('/dashboard');

      // 로그인 사용자는 인증 페이지 접근 시 콘솔로 — 회원은 열람이 아니라
      // 업무가 목적. 승인 대기(pending)는 콘솔 진입 불가라 홈으로.
      if (isLoggedIn && isAuthPage) {
        const target = status === 'active' ? '/admin' : '/';
        return Response.redirect(new URL(target, nextUrl.origin));
      }

      // 관리 콘솔(/admin) 코스 게이트: 로그인 + 정회원(active)만.
      // 메뉴별 세밀 권한은 서버 레이아웃(app/admin/layout.tsx)이 매트릭스로 판정한다.
      if (isAdminRoute) {
        if (!isLoggedIn) return false; // → signIn 페이지
        if (status !== 'active') {
          return Response.redirect(new URL('/', nextUrl.origin));
        }
      } else if (!isLoggedIn && isProtectedRoute) {
        return false;
      }

      // 서버 레이아웃이 메뉴를 판정할 수 있도록 신뢰 가능한 pathname 주입.
      // 인바운드 x-pathname을 nextUrl.pathname으로 덮어써 위조를 차단한다.
      const headers = new Headers(request.headers);
      headers.set('x-pathname', pathname);
      return NextResponse.next({ request: { headers } });
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.status = user.status;
      }
      // 프로필에서 이름을 바꾸면 update({ name })로 토큰에 즉시 반영
      if (trigger === 'update' && typeof session?.name === 'string') {
        token.name = session.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role;
        session.user.status = token.status;
      }
      return session;
    },
  },
};
