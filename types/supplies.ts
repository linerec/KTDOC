// types/supplies.ts
// 준비물(What to Bring) — 재사용 카탈로그 + 이벤트/수업 연결 타입 정의

import { generateSlug } from '@/types/gallery';

export { generateSlug };

// ============================================
// Supply Item (카탈로그)
// ============================================

export interface SupplyItem {
  id: number;
  slug: string;
  name_ko: string;
  name_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  image_url: string | null;
  image_r2_key: string | null;
  glossary_term_id: number | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 목록·연결 표시용 — 연결된 말모이 용어의 발음/뜻을 결합. */
export interface SupplyItemWithTerm extends SupplyItem {
  term_ko: string | null;
  term_pronunciation: string | null;
  term_slug: string | null;
}

export interface CreateSupplyItemInput {
  name_ko: string;
  name_en?: string;
  description_ko?: string;
  description_en?: string;
  image_url?: string | null;
  image_r2_key?: string | null;
  glossary_term_id?: number | null;
  is_active?: boolean;
  sort_order?: number;
  slug?: string;
}

export type UpdateSupplyItemInput = Partial<CreateSupplyItemInput>;

export interface SupplyItemFilters {
  search?: string;
  active?: boolean | 'all';
  limit?: number;
  page?: number;
}

// ============================================
// Links (이벤트/수업 ↔ 준비물)
// ============================================

/** event_supplies / program_supplies 공통 연결 필드. */
export interface SupplyLinkBase {
  id: number;
  supply_item_id: number;
  quantity: string | null;
  note_ko: string | null;
  note_en: string | null;
  is_required: number;
  sort_order: number;
}

export interface EventSupply extends SupplyLinkBase {
  event_id: number;
}

export interface ProgramSupply extends SupplyLinkBase {
  program_id: number;
}

/** 상세 화면 표시용 — 연결 + 카탈로그 항목(이름·사진·발음)을 결합. */
export interface SupplyLinkWithItem extends SupplyLinkBase {
  name_ko: string;
  name_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  image_url: string | null;
  term_slug: string | null;
  term_pronunciation: string | null;
}

/** 폼 제출용 연결 입력(순서는 배열 인덱스로 결정). */
export interface SupplyLinkInput {
  supply_item_id: number;
  quantity?: string;
  note_ko?: string;
  note_en?: string;
  is_required?: boolean;
}

/** API 바디의 임의 supplies 배열을 안전한 SupplyLinkInput[]로 정규화한다. */
export function normalizeSupplyLinks(raw: unknown): SupplyLinkInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l) => ({
      supply_item_id: Number(l.supply_item_id),
      quantity: typeof l.quantity === 'string' ? l.quantity : undefined,
      note_ko: typeof l.note_ko === 'string' ? l.note_ko : undefined,
      note_en: typeof l.note_en === 'string' ? l.note_en : undefined,
      is_required: l.is_required !== false,
    }))
    .filter((l) => Number.isFinite(l.supply_item_id) && l.supply_item_id > 0);
}

// ============================================
// Supply Set (준비물 세트 — 항목을 묶은 상위 레이어)
// ============================================

export interface SupplySet {
  id: number;
  slug: string;
  name_ko: string;
  name_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 세트 구성 항목(세트에 포함된 카탈로그 항목의 요약). */
export interface SupplySetMemberItem {
  supply_item_id: number;
  name_ko: string;
  name_en: string | null;
  image_url: string | null;
  term_slug: string | null;
  term_pronunciation: string | null;
}

/** 관리 목록·선택기·표시용 — 세트 + 포함 항목들. */
export interface SupplySetWithItems extends SupplySet {
  items: SupplySetMemberItem[];
}

export interface CreateSupplySetInput {
  name_ko: string;
  name_en?: string;
  description_ko?: string;
  description_en?: string;
  is_active?: boolean;
  sort_order?: number;
  slug?: string;
  /** 세트 구성 항목 id 목록(제공되면 전량 교체). */
  item_ids?: number[];
}

export type UpdateSupplySetInput = Partial<CreateSupplySetInput>;

export interface SupplySetFilters {
  search?: string;
  active?: boolean | 'all';
  limit?: number;
  page?: number;
}

// ============================================
// Set links (이벤트/수업 ↔ 세트)
// ============================================

/** 폼 제출용 세트 연결 입력. */
export interface SupplySetLinkInput {
  supply_set_id: number;
  quantity?: string;
  note_ko?: string;
  note_en?: string;
  is_required?: boolean;
}

/** 상세 표시용 — 세트 연결 + 세트 정보 + 포함 항목들. */
export interface SupplySetLinkWithItems {
  id: number;
  supply_set_id: number;
  quantity: string | null;
  note_ko: string | null;
  note_en: string | null;
  is_required: number;
  sort_order: number;
  name_ko: string;
  name_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  items: SupplySetMemberItem[];
}

export function normalizeSupplySetLinks(raw: unknown): SupplySetLinkInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l) => ({
      supply_set_id: Number(l.supply_set_id),
      quantity: typeof l.quantity === 'string' ? l.quantity : undefined,
      note_ko: typeof l.note_ko === 'string' ? l.note_ko : undefined,
      note_en: typeof l.note_en === 'string' ? l.note_en : undefined,
      is_required: l.is_required !== false,
    }))
    .filter((l) => Number.isFinite(l.supply_set_id) && l.supply_set_id > 0);
}
