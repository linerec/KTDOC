/**
 * 공연 편집 폼이 주고받는 값의 모양
 *
 * 폼은 필드 묶음(BasicFields·LogisticsFields·…)으로 갈라져 있고, 그 사이를 오가는 것은
 * 이 두 가지뿐이다 — 현재 값(EventFormData)과 값을 바꾸는 두 갈래(handleChange/patchForm).
 * 묶음마다 props를 새로 만들지 않도록 여기 모아 둔다.
 */

import type { ChangeEvent } from 'react';
import type { EventKind } from '@/types/gallery';

export interface EventFormData {
  title_ko: string;
  title_en: string;
  event_date: string;
  /** 미선택은 빈 문자열 — <select>의 value가 문자열이라 그대로 둔다 */
  category_id: number | string;
  kind: EventKind;
  description_ko: string;
  description_en: string;
  is_published: boolean;
  is_featured: boolean;
  is_signature: boolean;
  signature_order: number | string;
  location: string;
  location_url: string;
  location_address: string;
  location_lat: number | null;
  location_lng: number | null;
  call_time: string;
  start_time: string;
  end_time: string;
  prep_notes: string;
}

/** name 속성을 그대로 쓰는 일반 입력 변경 */
export type FormChangeHandler = (
  e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
) => void;

/** 여러 필드를 한 번에 바꾸는 경우(LocationPicker처럼 묶음으로 오는 값) */
export type FormPatchHandler = (patch: Partial<EventFormData>) => void;

/** 필드 묶음이 공통으로 받는 props */
export interface FieldGroupProps {
  formData: EventFormData;
  onChange: FormChangeHandler;
}
