import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';
import type { MemberRole, MemberStatus } from '@/types/members';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      /** 신분(원생·학부모·선생님·운영). 관리 권한은 isAdmin이 따로 갖는다. */
      role: MemberRole;
      /**
       * 관리 권한. 이미 발급된 낡은 토큰에는 이 클레임이 없으므로 optional이고,
       * jwt 콜백이 DB에서 보충한다(재로그인 없이 새 체계로 넘어온다).
       */
      isAdmin?: boolean;
      status: MemberStatus;
      /** 임시 비밀번호로 로그인한 상태 — 새 비밀번호 설정이 강제된다 */
      mustChangePassword?: boolean;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: MemberRole;
    isAdmin?: boolean;
    status: MemberStatus;
    mustChangePassword?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    role: MemberRole;
    isAdmin?: boolean;
    status: MemberStatus;
    mustChangePassword?: boolean;
  }
}
