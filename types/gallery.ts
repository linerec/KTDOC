// types/gallery.ts
// Gallery 아카이브 시스템 타입 정의

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
  poster_url: string | null;
  poster_r2_key: string | null;
  thumbnail_url: string | null;
  thumbnail_r2_key: string | null;
  is_featured: number;
  is_published: number;
  view_count: number;
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

export interface EventDetail extends EventWithCategory {
  images: EventImage[];
  videos: EventVideo[];
  category: EventCategory | null;
}

// API Request/Response 타입
export interface EventFilters {
  year?: number;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  featured?: boolean;
  published?: boolean;
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
  description_ko?: string;
  description_en?: string;
  is_published?: boolean;
  is_featured?: boolean;
  slug?: string;
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

export function formatEventDate(dateStr: string, locale: 'ko' | 'en' = 'ko'): string {
  const date = new Date(dateStr);
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
  const date = new Date(dateStr);
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
