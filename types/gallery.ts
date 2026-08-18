// types/gallery.ts
// Gallery 아카이브 시스템 타입 정의

/**
 * 이벤트 종류 — category_id('어떤 공연인가')와 직교하는 축.
 * 'performance' = 대외 공연, 'school' = 수료식·발표회 등 학내 행사.
 */
export type EventKind = 'performance' | 'school';

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  performance: '공연',
  school: '학내 행사',
};

export const EVENT_KIND_LABELS_EN: Record<EventKind, string> = {
  performance: 'Performance',
  school: 'School Event',
};

export interface EventCategory {
  id: number;
  slug: string;
  name_ko: string;
  name_en: string;
  sort_order: number;
  created_at: string;
}

export interface Event {
  id: number;
  slug: string;
  year: number;
  event_date: string;
  title_ko: string;
  title_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  category_id: number | null;
  kind: EventKind;
  poster_url: string | null;
  poster_r2_key: string | null;
  thumbnail_url: string | null;
  thumbnail_r2_key: string | null;
  is_featured: number;
  is_published: number;
  is_signature: number;
  signature_order: number;
  view_count: number;
  // 실행 정보(멤버가 "어디서·언제·무엇을 준비"를 바로 파악). 모두 nullable.
  location: string | null;
  location_url: string | null;
  // 구조화 위치(지오코딩 결과) — 좌표가 있으면 상세 페이지에 지도를 렌더링한다.
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  call_time: string | null;
  start_time: string | null;
  end_time: string | null;
  prep_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventWithCategory extends Event {
  category_name_ko: string | null;
  category_name_en: string | null;
  category_slug: string | null;
  first_image_url?: string | null;
}

export interface EventImage {
  id: number;
  event_id: number;
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

export interface EventVideo {
  id: number;
  event_id: number;
  youtube_url: string;
  youtube_id: string;
  title: string | null;
  sort_order: number;
  created_at: string;
}

export interface GalleryPhoto {
  id: number;
  image_url: string;
  r2_key: string;
  caption_ko: string | null;
  caption_en: string | null;
  taken_date: string | null;
  event_id: number | null;
  /** 수업(programs.id) 연결 — 학생이 '내 수업' 상세에서 제출한 사진. 이벤트/수업 중 택일 */
  program_id: number | null;
  event_image_id: number | null;
  is_published: number;
  is_featured: number;
  sort_order: number;
  width: number | null;
  height: number | null;
  size: number | null;
  created_at: string;
  updated_at: string;
  /** 제출자(MySQL users.id). NULL = 운영진 직접 업로드, 값 있음 = 학생·학부모 제출 */
  uploaded_by: string | null;
  event_title_ko?: string | null;
  event_title_en?: string | null;
  event_year?: number | null;
  event_slug?: string | null;
  /** program_id 조인 메타 — 일부 조회에서만 채워진다 */
  program_title_ko?: string | null;
  program_slug?: string | null;
  /** uploaded_by를 회원 이름으로 해석한 값 — 일부 조회에서만 채워진다 */
  uploader_name?: string | null;
}

// 이벤트 체크인(학생 참여) ------------------------------------------

/** 체크인 상태: 참가 완료(attended) | 참가 예정(going, 향후 확장) */
export type CheckinStatus = 'attended' | 'going';

export interface EventCheckin {
  id: number;
  event_id: number;
  /** 참여 학생 (MySQL users.id). 교차 저장소라 FK 없이 문자열만 보관 */
  user_id: string;
  status: CheckinStatus;
  note: string | null;
  checked_in_at: string;
  created_at: string;
  /** user_id를 회원 이름으로 해석한 값 — 참가자 목록 화면에서만 채워진다 */
  user_name?: string | null;
}

/** 학생 아카이브 목록 한 줄: 체크인한 이벤트 상세 + 체크인 메타 */
export interface CheckedInEvent extends EventWithCategory {
  checked_in_at: string;
  checkin_status: CheckinStatus;
}

/** 참여도 검증(운영진)용: 이벤트 1개 + 참가자 수 */
export interface EventParticipation {
  event_id: number;
  title_ko: string;
  title_en: string | null;
  year: number;
  event_date: string;
  is_published: number;
  participant_count: number;
}

export interface EventDetail extends EventWithCategory {
  images: EventImage[];
  /** 이벤트의 전체 이미지 수 (images는 페이지네이션된 첫 묶음일 수 있음) */
  image_total?: number;
  videos: EventVideo[];
  category: EventCategory | null;
}

export interface EventImagesResponse {
  images: EventImage[];
  total: number;
}

// API Request/Response 타입
export interface EventFilters {
  year?: number;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  featured?: boolean;
  published?: boolean | 'all';
  showcase?: boolean;
  /** 종류 필터 — 미지정이거나 'all'이면 전체 */
  kind?: EventKind | 'all';
}

export interface GalleryPhotoFilters {
  search?: string;
  page?: number;
  limit?: number;
  published?: boolean;
  organized?: 'all' | 'assigned' | 'unassigned';
  /** 특정 이벤트로 필터 */
  eventId?: number;
  /** 특정 수업(programs.id)으로 필터 */
  programId?: number;
  /** 정렬 기준 (기본 recent) */
  sort?: 'recent' | 'oldest' | 'taken';
  /** 특정 회원(users.id)이 올린 사진만 — 학생 본인 "내 사진" 목록용 */
  uploadedBy?: string;
  /** 제출 출처 필터: student=학생 제출(uploaded_by 있음), staff=직접 업로드(NULL) */
  submitted?: 'all' | 'student' | 'staff';
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EventsResponse {
  events: EventWithCategory[];
  pagination: PaginationInfo;
  years: number[];
}

export interface CreateEventInput {
  title_ko: string;
  title_en?: string;
  event_date: string;
  category_id?: number;
  kind?: EventKind;
  description_ko?: string;
  description_en?: string;
  is_published?: boolean;
  is_featured?: boolean;
  is_signature?: boolean;
  signature_order?: number;
  slug?: string;
  // 실행 정보
  location?: string;
  location_url?: string;
  // 구조화 위치 — null이면 값 지우기
  location_address?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  call_time?: string;
  start_time?: string;
  end_time?: string;
  prep_notes?: string;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
  poster_url?: string;
  poster_r2_key?: string;
  thumbnail_url?: string;
  thumbnail_r2_key?: string;
}

export interface CreateImageInput {
  image_url: string;
  r2_key: string;
  caption_ko?: string;
  caption_en?: string;
  width?: number;
  height?: number;
  size?: number;
}

export interface CreateVideoInput {
  youtube_url: string;
  title?: string;
}

export interface CreateGalleryPhotoInput {
  image_url: string;
  r2_key: string;
  caption_ko?: string;
  caption_en?: string;
  taken_date?: string;
  event_id?: number;
  /** 수업 연결 — 학생이 '내 수업' 상세에서 제출 시 설정 */
  program_id?: number;
  is_published?: boolean;
  is_featured?: boolean;
  width?: number;
  height?: number;
  size?: number;
  /** 제출자(users.id). 학생 제출 시 설정, 운영진 업로드 시 생략 */
  uploaded_by?: string;
}

export interface UpdateGalleryPhotoInput {
  caption_ko?: string | null;
  caption_en?: string | null;
  taken_date?: string | null;
  event_id?: number | null;
  program_id?: number | null;
  is_published?: boolean;
  is_featured?: boolean;
  sort_order?: number;
}

export interface CreateCategoryInput {
  slug: string;
  name_ko: string;
  name_en: string;
  sort_order?: number;
}

// 유틸리티 함수 타입
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /youtube\.com\/v\/([^&\s?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * 'YYYY-MM-DD'를 로컬 자정 Date로 파싱한다.
 * new Date('YYYY-MM-DD')는 UTC 자정으로 해석돼 미국 시간대에서 하루가 밀린다(-1일 버그).
 */
function parseLocalDate(dateStr: string): Date {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }
  return new Date(dateStr);
}

export function formatEventDate(dateStr: string, locale: 'ko' | 'en' = 'ko'): string {
  const date = parseLocalDate(dateStr);
  if (locale === 'ko') {
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Intl.DateTimeFormat을 활용한 날짜 포맷팅
 * 한국어: 2024년 12월 9일 (월)
 * 영어: Monday, December 9, 2024
 */
export function formatEventDateIntl(dateStr: string, locale: 'ko' | 'en' = 'ko'): string {
  const date = parseLocalDate(dateStr);
  const localeCode = locale === 'ko' ? 'ko-KR' : 'en-US';

  const formatter = new Intl.DateTimeFormat(localeCode, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return formatter.format(date);
}

/**
 * 연도 없는 월·일 — 연도가 이미 그룹 헤딩에 있는 자리용(타임라인 압축 행).
 * 한국어: 5월 12일 / 영어: Sep 30 (짧은 월 — 고정 폭 칼럼에 들어가야 한다)
 */
export function formatEventDateMonthDay(dateStr: string, locale: 'ko' | 'en' = 'ko'): string {
  const date = parseLocalDate(dateStr);
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: locale === 'ko' ? 'long' : 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * 공연 시각을 공개 화면용 문구로 만든다. 시각이 없으면 빈 문자열.
 *
 * `HH:MM`(24시간)으로 저장된 값을 읽는 사람 기준으로 옮긴다 —
 *   ko: "오후 7:30", "오후 7:30 – 9:00"
 *   en: "7:30 PM", "7:30 PM – 9:00 PM"
 *
 * ── 집합 시간(call_time)은 여기 오지 않는다 ────────────────────────────────
 * 집합 시각은 **출연자용 내부 정보**다. 관객이 보는 자리에 "집합 6시"가 있으면
 * 입장 시각으로 읽혀 한 시간 일찍 오는 사람이 생긴다. 관리 콘솔과 출연자 안내에만
 * 남긴다(호출부에서 아예 넘기지 않는다).
 */
export function formatEventTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  locale: 'ko' | 'en' = 'ko'
): string {
  const fmt = (hhmm: string | null | undefined): string | null => {
    if (!hhmm) return null;
    const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const hour = Number(m[1]);
    const minute = m[2];
    if (hour > 23) return null;
    if (locale === 'en') {
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      return `${h12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;
    }
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour < 12 ? '오전' : '오후'} ${h12}:${minute}`;
  };

  const start = fmt(startTime);
  const end = fmt(endTime);
  if (!start) return end ?? '';
  if (!end) return start;
  // 하이픈(-)이 아니라 en dash(–)다. 시각 범위의 관례 표기이고, 폰트에서 숫자와
  // 붙었을 때 마이너스로 읽히지 않는다.
  return `${start} – ${end}`;
}

/**
 * Intl.RelativeTimeFormat을 활용한 상대 시간 표시
 * 예: "3일 전", "2주 전", "1년 전"
 */
export function formatRelativeTime(dateStr: string, locale: 'ko' | 'en' = 'ko'): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const localeCode = locale === 'ko' ? 'ko-KR' : 'en-US';
  const rtf = new Intl.RelativeTimeFormat(localeCode, { numeric: 'auto' });

  if (diffDays < 7) {
    return rtf.format(-diffDays, 'day');
  } else if (diffDays < 30) {
    return rtf.format(-Math.floor(diffDays / 7), 'week');
  } else if (diffDays < 365) {
    return rtf.format(-Math.floor(diffDays / 30), 'month');
  } else {
    return rtf.format(-Math.floor(diffDays / 365), 'year');
  }
}

/**
 * AI 포스터/텍스트 추출 결과 (신뢰 불가 입력 — 서버가 정규화 후 전달).
 * 값을 찾지 못한 필드는 null이며, 폼은 null 필드를 건드리지 않는다.
 */
export interface ExtractedEventInfo {
  title_ko: string | null;
  title_en: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  call_time: string | null;
  description_ko: string | null;
  description_en: string | null;
  location: string | null;
  location_address: string | null;
  prep_notes: string | null;
  category_id: number | null;
}
