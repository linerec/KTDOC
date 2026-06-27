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
});
