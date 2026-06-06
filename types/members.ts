/**
 * 회원(users) 공용 타입·상수
 *
 * DB 의존성이 없어 클라이언트 컴포넌트에서도 안전하게 import할 수 있다.
 * (DB 조회 함수는 server 전용 lib/members.ts 참고)
 */

export type MemberRole = 'user' | 'admin';

export const MEMBER_ROLES: MemberRole[] = ['user', 'admin'];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  user: '일반 회원',
  admin: '관리자',
};

export interface Member {
  id: string;
  email: string;
  name: string | null;
  /** 이메일 인증 일시(ISO) 또는 미인증 시 null */
  email_verified: string | null;
  role: MemberRole;
  created_at: string;
  updated_at: string;
}

export interface MemberCounts {
  total: number;
  admins: number;
  users: number;
  verified: number;
}
