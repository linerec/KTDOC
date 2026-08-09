'use client';

/**
 * 카테고리 한 줄 입력 — 추가할 때와 수정할 때가 같은 필드다
 *
 * 두 자리에 같은 마크업이 복사돼 있어 한쪽만 고치면 어긋났다. 버튼 문구만 다르므로
 * 그것만 받아서 쓴다.
 */

import type { CreateCategoryInput } from '@/types/gallery';
import { useT } from '@/lib/i18n/useT';

interface CategoryFieldsProps {
  value: CreateCategoryInput;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  /** 확정 버튼 문구 — 추가는 '추가', 수정은 '저장' */
  submitLabel: string;
  /** slug 칸의 안내 — 추가할 때만 예시를 곁들인다 */
  slugPlaceholder: string;
}

export default function CategoryFields({
  value,
  onChange,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
  slugPlaceholder,
}: CategoryFieldsProps) {
  const t = useT();

  return (
    <div className="admin-category-form">
      <input
        type="text"
        name="slug"
        value={value.slug}
        onChange={onChange}
        placeholder={slugPlaceholder}
        className="admin-form-input admin-form-input-sm"
      />
      <input
        type="text"
        name="name_ko"
        value={value.name_ko}
        onChange={onChange}
        placeholder={t('admin.categories.nameKo', '한글명')}
        className="admin-form-input admin-form-input-sm"
      />
      <input
        type="text"
        name="name_en"
        value={value.name_en}
        onChange={onChange}
        placeholder={t('admin.categories.nameEn', '영문명')}
        className="admin-form-input admin-form-input-sm"
      />
      <input
        type="number"
        name="sort_order"
        value={value.sort_order}
        onChange={onChange}
        placeholder={t('admin.categories.order', '순서')}
        className="admin-form-input admin-form-input-sm admin-form-input-number"
      />
      <div className="admin-category-actions">
        <button
          type="button"
          className="admin-btn admin-btn-sm admin-btn-primary"
          onClick={onSubmit}
          disabled={saving}
        >
          {saving ? '...' : submitLabel}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-sm"
          onClick={onCancel}
          disabled={saving}
        >
          {t('admin.common.cancel', '취소')}
        </button>
      </div>
    </div>
  );
}
