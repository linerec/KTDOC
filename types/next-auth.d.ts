import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';
import type { MemberRole, MemberStatus } from '@/types/members';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: MemberRole;
      status: MemberStatus;
      /** 임시 비밀번호로 로그인한 상태 — 새 비밀번호 설정이 강제된다 */
      mustChangePassword?: boolean;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: MemberRole;
    status: MemberStatus;
    mustChangePassword?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    role: MemberRole;
    status: MemberStatus;
    mustChangePassword?: boolean;
  }
}
