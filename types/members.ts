/**
 * 회원(users) 공용 타입·상수
 *
 * DB 의존성이 없어 클라이언트 컴포넌트에서도 안전하게 import할 수 있다.
 * (DB 조회 함수는 server 전용 lib/members.ts 참고)
 */

/**
 * 회원 역할
 * - user: 레거시 일반 회원(역할 분리 이전 가입자)
 * - student: 원생
 * - parent: 학부모
 * - teacher: 선생님(승인 권한 보유)
 * - admin: 관리자(전체 권한)
 */
export type MemberRole = 'user' | 'student' | 'parent' | 'teacher' | 'admin';

/** 셀프 가입이 가능한 역할 (선생님·관리자는 관리자가 부여) */
export type SignupRole = 'student' | 'parent';

/**
 * 승인 상태
 * - pending: 가입 후 승인 대기
 * - active: 정회원(승인 완료)
 * - rejected: 가입 거절
 * - suspended: 이용 정지
 */
export type MemberStatus = 'pending' | 'active' | 'rejected' | 'suspended';

export const MEMBER_ROLES: MemberRole[] = [
  'user',
  'student',
  'parent',
  'teacher',
  'admin',
];

export const SIGNUP_ROLES: SignupRole[] = ['student', 'parent'];

export const MEMBER_STATUSES: MemberStatus[] = [
  'pending',
  'active',
  'rejected',
  'suspended',
];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  user: '일반 회원',
  student: '원생',
  parent: '학부모',
  teacher: '선생님',
  admin: '관리자',
};

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  pending: '승인 대기',
  active: '정회원',
  rejected: '거절',
  suspended: '정지',
};

/** 승인 권한(선생님·관리자)을 가진 역할 */
export const STAFF_ROLES: MemberRole[] = ['teacher', 'admin'];

export interface Member {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: MemberRole;
  status: MemberStatus;
  /** 원생 입학년도 (원생이 아니면 null) */
  enrollment_year: number | null;
  /** 공개 수강생 페이지(/students) 노출 동의 여부 (학생 본인이 프로필에서 토글) */
  public_archive_consent: boolean;
  /** 이메일 인증 일시(ISO) 또는 미인증 시 null */
  email_verified: string | null;
  created_at: string;
  updated_at: string;
  /** 학부모: 연결된 자녀(원생) 목록 */
  children?: GuardianChild[];
  /** 원생: 연결된 보호자(학부모) 목록 */
  guardians?: GuardianContact[];
}

/** 학부모-원생 연결 정보 (학부모 입장에서 본 자녀) */
export interface GuardianChild {
  /** student_guardians.id */
  linkId: string;
  /** 연결이 확정된 원생 user.id (동명이인 등으로 미해결 시 null) */
  studentId: string | null;
  /** 연결된 원생 이름(확정 시) */
  studentName: string | null;
  /** 학부모가 가입 때 입력한 자녀 이름 */
  claimedName: string;
  /** 학부모가 가입 때 입력한 입학년도 */
  claimedEnrollmentYear: number | null;
}

/** 원생 입장에서 본 보호자(학부모) */
export interface GuardianContact {
  guardianId: string;
  guardianName: string | null;
  guardianEmail: string;
}

export interface MemberCounts {
  total: number;
  pending: number;
  active: number;
  admins: number;
  teachers: number;
  students: number;
  parents: number;
}
