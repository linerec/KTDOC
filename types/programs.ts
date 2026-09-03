// types/programs.ts
// 수업·프로그램·캠프 + 신청 시스템 타입 정의 (types/gallery.ts 규약을 따름)

import { generateSlug } from '@/types/gallery';

export { generateSlug };

export type ProgramType = 'class' | 'program' | 'camp';
export type ApplicationStatus = 'new' | 'contacted' | 'confirmed' | 'cancelled';

export const PROGRAM_TYPES: ProgramType[] = ['class', 'program', 'camp'];

export const PROGRAM_TYPE_LABELS: Record<ProgramType, { ko: string; en: string }> = {
  class: { ko: '수업', en: 'Class' },
  program: { ko: '프로그램', en: 'Program' },
  camp: { ko: '캠프', en: 'Camp' },
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, { ko: string; en: string }> = {
  new: { ko: '신규', en: 'New' },
  contacted: { ko: '연락함', en: 'Contacted' },
  confirmed: { ko: '확정', en: 'Confirmed' },
  cancelled: { ko: '취소', en: 'Cancelled' },
};

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'new',
  'contacted',
  'confirmed',
  'cancelled',
];

// ============================================
// Program
// ============================================

export interface Program {
  id: number;
  slug: string;
  program_type: ProgramType;
  title_ko: string;
  title_en: string | null;
  summary_ko: string | null;
  summary_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  age_range: string | null;
  schedule_ko: string | null;
  schedule_en: string | null;
  start_date: string | null;
  end_date: string | null;
  // 정규 수업(class/program) 반복 일정 — 캘린더 표시용. camp는 start_date/end_date 사용.
  weekdays: string | null; // 쉼표구분 요일(0=일 ~ 6=토). 예: "6"=토, "1,3"=월·수
  /** 쉼표구분 주차(1~5). 예 "2,4"=매월 둘째·넷째 주. 비우면 매주. */
  week_ordinals: string | null;
  /** 쉼표구분 'YYYY-MM-DD' — 이 날은 쉰다(휴강·주차 이동) */
  skip_dates: string | null;
  /** 쉼표구분 'YYYY-MM-DD' — 규칙과 무관하게 이 날은 한다(보강·주차 이동) */
  extra_dates: string | null;
  class_start_time: string | null; // "HH:MM"
  class_end_time: string | null; // "HH:MM"
  term_start_date: string | null; // 학기 시작 "YYYY-MM-DD"(비우면 상시)
  term_end_date: string | null; // 학기 종료 "YYYY-MM-DD"
  price_ko: string | null;
  price_en: string | null;
  location_ko: string | null;
  location_en: string | null;
  poster_url: string | null;
  poster_r2_key: string | null;
  thumbnail_url: string | null;
  thumbnail_r2_key: string | null;
  is_featured: number;
  is_published: number;
  /** 이 수업의 신청을 받는 신청서(forms.id). NULL이면 옛 신청 모달을 쓴다. */
  active_form_id: number | null;
  sort_order: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProgramWithMeta extends Program {
  first_image_url?: string | null;
}

export interface ProgramImage {
  id: number;
  program_id: number;
  image_url: string;
  r2_key: string;
  sort_order: number;
  caption_ko: string | null;
  caption_en: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  created_at: string;
}

export interface ProgramDetail extends ProgramWithMeta {
  images: ProgramImage[];
}

// ============================================
// Application
// ============================================

export interface Application {
  id: number;
  program_id: number | null;
  program_title_ko: string | null;
  applicant_name: string;
  guardian_name: string | null;
  email: string;
  phone: string | null;
  participant_age: string | null;
  message: string | null;
  consent: number;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface ApplicationWithProgram extends Application {
  program_type?: ProgramType | null;
  program_slug?: string | null;
}

// ============================================
// Enrollment (수강생)
// ============================================
//   운영진(관리자·선생님)이 programs에 원생(회원)을 수강생으로 배정한다.
//   user_id = MySQL users.id. 회원 이름은 호출부에서 getUserNamesByIds(MySQL)로 해석.

export type EnrollmentStatus = 'active' | 'waitlist' | 'completed' | 'cancelled';

export const ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  'active',
  'waitlist',
  'completed',
  'cancelled',
];

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, { ko: string; en: string }> = {
  active: { ko: '수강 중', en: 'Active' },
  waitlist: { ko: '대기', en: 'Waitlist' },
  completed: { ko: '수료', en: 'Completed' },
  cancelled: { ko: '취소', en: 'Cancelled' },
};

/** program_enrollments 행(D1 스키마 직렬화) */
export interface ProgramEnrollment {
  id: number;
  program_id: number;
  user_id: string;
  status: EnrollmentStatus;
  note: string | null;
  enrolled_by: string | null;
  enrolled_at: string;
  created_at: string;
}

/** 운영진 프로그램 편집 화면용 — 회원 이름·입학년도 결합(이름은 MySQL에서 해석). */
export interface EnrollmentWithMember extends ProgramEnrollment {
  member_name: string | null;
  enrollment_year: number | null;
}

/** 원생·학부모 '내 수업' 화면용 — 프로그램 메타를 중첩으로 결합. user_id는 학부모 자녀 그룹핑용. */
export interface MyEnrollment {
  enrollment_id: number;
  user_id: string;
  status: EnrollmentStatus;
  note: string | null;
  enrolled_at: string;
  program: ProgramWithMeta;
}

export interface CreateEnrollmentInput {
  user_id: string;
  status?: EnrollmentStatus;
  note?: string | null;
  enrolled_by?: string | null;
}

export interface UpdateEnrollmentInput {
  status?: EnrollmentStatus;
  note?: string | null;
}

// ============================================
// Filters
// ============================================

export interface ProgramFilters {
  type?: ProgramType;
  search?: string;
  page?: number;
  limit?: number;
  featured?: boolean;
  published?: boolean | 'all';
}

export interface ApplicationFilters {
  program_id?: number;
  status?: ApplicationStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================
// Input types
// ============================================

export interface CreateProgramInput {
  program_type: ProgramType;
  title_ko: string;
  title_en?: string;
  summary_ko?: string;
  summary_en?: string;
  description_ko?: string;
  description_en?: string;
  age_range?: string;
  schedule_ko?: string;
  schedule_en?: string;
  start_date?: string;
  end_date?: string;
  weekdays?: string;
  week_ordinals?: string;
  skip_dates?: string;
  extra_dates?: string;
  class_start_time?: string;
  class_end_time?: string;
  term_start_date?: string;
  term_end_date?: string;
  price_ko?: string;
  price_en?: string;
  location_ko?: string;
  location_en?: string;
  is_featured?: boolean;
  is_published?: boolean;
  sort_order?: number;
  slug?: string;
}

export interface UpdateProgramInput extends Partial<CreateProgramInput> {
  /** 신청서 연결. null 을 넘기면 연결을 끊는다(undefined 는 '건드리지 않음'). */
  active_form_id?: number | null;
  poster_url?: string;
  poster_r2_key?: string;
  thumbnail_url?: string;
  thumbnail_r2_key?: string;
}

export interface CreateProgramImageInput {
  image_url: string;
  r2_key: string;
  caption_ko?: string;
  caption_en?: string;
  width?: number;
  height?: number;
  size?: number;
}

// 방문자 신청 폼 제출 페이로드 (status/consent는 서버에서 검증/설정)
export interface CreateApplicationInput {
  program_id: number;
  applicant_name: string;
  guardian_name?: string;
  email: string;
  phone?: string;
  participant_age?: string;
  message?: string;
  consent: boolean;
  website?: string; // honeypot — 비어 있어야 함
  _t?: number; // 클라이언트 렌더 타임스탬프 (최소 제출시간 검증)
}

export interface UpdateApplicationStatusInput {
  status: ApplicationStatus;
}

// ============================================
// Utilities
// ============================================

/**
 * camp 기간(start_date~end_date) 기준의 정성적 모집 상태.
 * 공개 시드 카운터 없이 날짜만으로 계산.
 */
export type EnrollmentSignal = 'upcoming' | 'enrolling' | 'closingSoon' | 'closed' | null;

export function getEnrollmentSignal(
  program: Pick<Program, 'program_type' | 'start_date' | 'end_date'>,
  nowMs: number
): EnrollmentSignal {
  if (program.program_type !== 'camp') return null;
  if (!program.start_date) return null;

  const start = new Date(program.start_date + 'T00:00:00').getTime();
  const rawEnd = program.end_date
    ? new Date(program.end_date + 'T23:59:59').getTime()
    : start;

  if (Number.isNaN(start)) return null;
  const end = Number.isNaN(rawEnd) ? start : rawEnd;

  const DAY = 24 * 60 * 60 * 1000;

  if (nowMs > end) return 'closed';
  if (nowMs >= start) return 'enrolling'; // 진행 중
  if (start - nowMs <= 14 * DAY) return 'closingSoon'; // 시작 2주 이내
  return 'upcoming';
}
