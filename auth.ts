import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { query } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { authConfig } from './auth.config';

interface DBUser {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: 'user' | 'admin';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const users = await query<DBUser[]>(
          'SELECT id, email, password_hash, name, role FROM users WHERE email = ?',
          [credentials.email]
        );

        const user = users[0];
        if (!user) return null;

        const isValid = await verifyPassword(
          credentials.password as string,
          user.password_hash
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
