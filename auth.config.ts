import type { NextAuthConfig } from 'next-auth';

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
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
      const isProtectedRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard');

      // Redirect logged-in users away from auth pages
      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL('/', nextUrl.origin));
      }

      // Protect admin/dashboard routes
      if (!isLoggedIn && isProtectedRoute) {
        return false; // Redirect to signIn page
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
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
        session.user.role = token.role as 'user' | 'admin';
      }
      return session;
    },
  },
};
