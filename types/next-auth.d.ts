import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';
import type { MemberRole, MemberStatus } from '@/types/members';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: MemberRole;
      status: MemberStatus;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: MemberRole;
    status: MemberStatus;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    role: MemberRole;
    status: MemberStatus;
  }
}
