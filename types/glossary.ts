// types/glossary.ts
// 말모이(Word Guide) — 한국 전통무용 용어 사전 타입 정의 (types/gallery.ts 규약을 따름)

import { generateSlug } from '@/types/gallery';

export { generateSlug };

// ============================================
// Category
// ============================================

export interface GlossaryCategory {
  id: number;
  slug: string;
  name_ko: string;
  name_en: string | null;
  sort_order: number;
  created_at: string;
}

export interface GlossaryCategoryWithCount extends GlossaryCategory {
  term_count: number;
}

// ============================================
// Term
// ============================================

export interface GlossaryTerm {
  id: number;
  slug: string;
  term_ko: string;
  term_en: string | null;
  /** 로마자 표기(검색·표준용). 예: 춤사위 → "chumsawi" */
  romanization: string | null;
  /** 읽기 발음 가이드(아이 발화용). 예: "choom-sah-wee" */
  pronunciation: string | null;
  definition_ko: string | null;
  definition_en: string | null;
  example_ko: string | null;
  example_en: string | null;
  category_id: number | null;
  image_url: string | null;
  image_r2_key: string | null;
  is_published: number;
  sort_order: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

/** 목록·공개 브라우저용 — 분류 이름을 결합. */
export interface GlossaryTermWithCategory extends GlossaryTerm {
  category_name_ko: string | null;
  category_name_en: string | null;
  category_slug: string | null;
}

// ============================================
// Filters
// ============================================

export interface GlossaryFilters {
  categoryId?: number;
  search?: string;
  published?: boolean | 'all';
  limit?: number;
  page?: number;
}

// ============================================
// Input types
// ============================================

export interface CreateGlossaryTermInput {
  term_ko: string;
  term_en?: string;
  romanization?: string;
  pronunciation?: string;
  definition_ko?: string;
  definition_en?: string;
  example_ko?: string;
  example_en?: string;
  category_id?: number | null;
  is_published?: boolean;
  sort_order?: number;
  slug?: string;
}

export interface UpdateGlossaryTermInput extends Partial<CreateGlossaryTermInput> {
  image_url?: string;
  image_r2_key?: string;
}

export interface CreateGlossaryCategoryInput {
  name_ko: string;
  name_en?: string;
  sort_order?: number;
  slug?: string;
}

export type UpdateGlossaryCategoryInput = Partial<CreateGlossaryCategoryInput>;
