import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { query } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { authConfig } from './auth.config';
import type { MemberRole, MemberStatus } from '@/types/members';

interface DBUser {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: MemberRole;
  status: MemberStatus;
}

/** 로그인 가능 상태: 승인 대기·정회원은 허용, 거절·정지는 차단 */
function canSignIn(status: MemberStatus): boolean {
  return status === 'pending' || status === 'active';
}

const credentialsProvider = Credentials({
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) {
      return null;
    }

    const users = await query<DBUser[]>(
      'SELECT id, email, password_hash, name, role, status FROM users WHERE email = ?',
      [credentials.email]
    );

    const user = users[0];
    if (!user) return null;

    const isValid = await verifyPassword(
      credentials.password as string,
      user.password_hash
    );

    if (!isValid) return null;

    // 거절·정지 회원은 로그인 차단 (승인 대기는 로그인 허용 후 안내)
    if (!canSignIn(user.status)) {
      console.warn(`로그인 차단: ${user.email} (status=${user.status})`);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };
  },
});

const devAdminProvider = Credentials({
  id: 'dev-admin',
  name: 'Dev Admin',
  credentials: {
    email: { label: 'Email', type: 'email' },
  },
  async authorize(credentials) {
    if (process.env.NODE_ENV !== 'development') return null;
    if (!credentials?.email) return null;

    const users = await query<DBUser[]>(
      'SELECT id, email, password_hash, name, role, status FROM users WHERE email = ?',
      [credentials.email]
    );

    const user = users[0];
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers:
    process.env.NODE_ENV === 'development'
      ? [credentialsProvider, devAdminProvider]
      : [credentialsProvider],
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      // 엣지(미들웨어)용 기본 콜백 먼저 수행: 로그인 시 user→token, 프로필 이름 갱신.
      const token = await authConfig.callbacks!.jwt!(params);
      if (!token) return token;

      // 레거시 토큰 자가 치유: status 게이트(auth.config) 도입 이전 발급된 토큰은
      // role만 있고 status가 없어 /admin 진입이 막힌다(메인으로 리다이렉트).
      // status 클레임이 비어 있으면 DB에서 현재 role·status를 보충해 토큰을 갱신한다.
      // 이 콜백은 Node 런타임(auth.ts)에서만 도므로 DB 접근이 안전하며,
      // 미들웨어가 쓰는 auth.config.ts는 DB-free로 유지된다.
      if (token.id && !token.status) {
        try {
          const rows = await query<{ role: MemberRole; status: MemberStatus }[]>(
            'SELECT role, status FROM users WHERE id = ?',
            [token.id]
          );
          const fresh = rows[0];
          if (fresh) {
            token.role = fresh.role;
            token.status = fresh.status;
          }
        } catch (err) {
          // DB 일시 장애 시 토큰을 망가뜨리지 않는다(기존 클레임 유지).
          console.error('JWT status 백필 실패:', err);
        }
      }

      return token;
    },
  },
});
