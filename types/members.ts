/**
 * 회원(users) 공용 타입·상수
 *
 * DB 의존성이 없어 클라이언트 컴포넌트에서도 안전하게 import할 수 있다.
 * (DB 조회 함수는 server 전용 lib/members.ts 참고)
 */

/**
 * 회원 **신분**. 이 사람이 학원에서 무엇인지를 말한다.
 *
 * 관리 권한은 여기 들어 있지 않다 — `users.is_admin` 플래그가 따로 갖는다.
 * 신분과 권한을 한 칸에 담으면 "선생님을 관리자로 만들면 선생님이기를 그만두는"
 * 일이 벌어진다. 선생님이면서 관리자, 원생이면서 관리자가 가능해야 한다.
 *
 * - user: 레거시 일반 회원(역할 분리 이전 가입자)
 * - student: 원생
 * - parent: 학부모
 * - teacher: 선생님
 * - staff: 운영 — 배우지도 가르치지도 않는 계정(학원 공용 계정·개발자)
 * - admin: **레거시**. 신분/권한을 분리(2026-08)하기 전의 값이다. 새로 부여하지
 *   않으며 MEMBER_ROLES에도 없다. DB enum과 롤백을 위해 타입에만 남겨 둔다.
 */
export type MemberRole = 'user' | 'student' | 'parent' | 'teacher' | 'staff' | 'admin';

/** 셀프 가입이 가능한 신분 (선생님·운영은 관리자가 부여) */
export type SignupRole = 'student' | 'parent';

/**
 * 승인 상태
 * - pending: 가입 후 승인 대기
 * - active: 정회원(승인 완료)
 * - rejected: 가입 거절
 * - suspended: 이용 정지
 */
export type MemberStatus = 'pending' | 'active' | 'rejected' | 'suspended';

/**
 * 고르고 거를 수 있는 신분 — 회원 관리 드롭다운·필터, 권한 매트릭스의 열,
 * 알림 대상 선택이 모두 이 목록을 쓴다. 레거시 'admin'은 여기 없다(더는
 * 부여하지 않는다). 'user'는 아직 남은 옛 가입자를 거를 수 있어야 하므로 남긴다.
 */
export const MEMBER_ROLES: MemberRole[] = [
  'user',
  'student',
  'parent',
  'teacher',
  'staff',
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
  staff: '운영',
  admin: '관리자(구)',
};

/** 관리 권한 표기 — 신분 옆에 따로 붙는다. */
export const ADMIN_FLAG_LABEL = '관리자';

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  pending: '승인 대기',
  active: '정회원',
  rejected: '거절',
  suspended: '정지',
};

/**
 * 신분만으로 운영진인 사람 — 선생님.
 * 승인·관리 권한 판정은 이 목록이 아니라 lib/isAdmin.ts의 isStaff()를 쓴다
 * (신분이 선생님이거나, 관리 권한 플래그를 가진 사람).
 */
export const STAFF_ROLES: MemberRole[] = ['teacher'];

export interface Member {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: MemberRole;
  /** 관리 권한 — 신분과 별개로 붙였다 뗐다 한다(선생님이면서 관리자가 가능). */
  is_admin: boolean;
  status: MemberStatus;
  /** 원생 입학년도 (원생이 아니면 null) */
  enrollment_year: number | null;
  /** 공개 수강생 페이지(/students) 노출 동의 여부 (학생 본인이 프로필에서 토글) */
  public_archive_consent: boolean;
  /** 프로필 사진 R2 공개 URL (없으면 이니셜 아바타 폴백) */
  profile_photo_url: string | null;
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
