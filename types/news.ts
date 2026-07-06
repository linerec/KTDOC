// types/news.ts
// 뉴스·미디어(/media) 게시물 타입 정의
// DB 의존성이 없어 클라이언트 컴포넌트에서도 안전하게 import할 수 있다.

/** 게시물 분류: 소식(news) | 언론 보도(press) | 영상(video) */
export type NewsCategory = 'news' | 'press' | 'video';

export const NEWS_CATEGORIES: readonly NewsCategory[] = ['news', 'press', 'video'];

/** 관리 콘솔(한국어 전용) 표시용 라벨 */
export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  news: '소식',
  press: '언론 보도',
  video: '영상',
};

export function isNewsCategory(value: unknown): value is NewsCategory {
  return value === 'news' || value === 'press' || value === 'video';
}

export interface NewsPost {
  id: number;
  category: NewsCategory;
  title_ko: string;
  title_en: string | null;
  body_ko: string | null;
  body_en: string | null;
  /** 언론 보도 출처(매체명) */
  source_name: string | null;
  /** 언론 보도 원문 링크 */
  external_url: string | null;
  /** 영상 게시물의 YouTube 링크(상세에서 임베드) */
  youtube_url: string | null;
  thumbnail_url: string | null;
  thumbnail_r2_key: string | null;
  is_published: number;
  /** 게시일 'YYYY-MM-DD' — 목록 정렬 기준 */
  published_at: string | null;
  /** 작성자 표시명(MySQL users와 교차 저장소라 FK 없이 문자열 보관) */
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsFilters {
  category?: NewsCategory;
  search?: string;
  page?: number;
  limit?: number;
  /** true=공개만(공개 페이지), false=비공개만, 'all'=전체(관리자) */
  published?: boolean | 'all';
}

export interface CreateNewsPostInput {
  category: NewsCategory;
  title_ko: string;
  title_en?: string | null;
  body_ko?: string | null;
  body_en?: string | null;
  source_name?: string | null;
  external_url?: string | null;
  youtube_url?: string | null;
  thumbnail_url?: string | null;
  thumbnail_r2_key?: string | null;
  is_published?: boolean;
  published_at?: string | null;
  created_by?: string | null;
}

export interface UpdateNewsPostInput {
  category?: NewsCategory;
  title_ko?: string;
  title_en?: string | null;
  body_ko?: string | null;
  body_en?: string | null;
  source_name?: string | null;
  external_url?: string | null;
  youtube_url?: string | null;
  thumbnail_url?: string | null;
  thumbnail_r2_key?: string | null;
  is_published?: boolean;
  published_at?: string | null;
}
