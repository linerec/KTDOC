// types/faq.ts
// Q&A(자주 묻는 질문) 타입 정의
// DB 의존성이 없어 클라이언트 컴포넌트에서도 안전하게 import할 수 있다.

export interface FaqItem {
  id: number;
  /** 연결된 이벤트(공연·행사) id. NULL = 공통 Q&A */
  event_id: number | null;
  question: string;
  answer: string;
  /** 그룹 내 표시 순서(작을수록 먼저) */
  sort_order: number;
  is_published: number;
  /** 작성자 표시명(MySQL users와 교차 저장소라 FK 없이 문자열 보관) */
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // 이벤트 조인 메타 — 목록 조회에서 채워진다
  event_title_ko?: string | null;
  event_year?: number | null;
  event_date?: string | null;
}

export interface FaqFilters {
  /** 숫자 = 특정 이벤트, 'general' = 공통만 */
  eventId?: number | 'general';
  /** true=공개만(보기 메뉴), 'all'=전체(관리) */
  published?: boolean | 'all';
}

export interface CreateFaqInput {
  event_id?: number | null;
  question: string;
  answer: string;
  sort_order?: number;
  is_published?: boolean;
  created_by?: string | null;
}

export interface UpdateFaqInput {
  event_id?: number | null;
  question?: string;
  answer?: string;
  sort_order?: number;
  is_published?: boolean;
}
