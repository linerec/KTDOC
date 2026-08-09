'use client';

/** 설명 한/영 — 좌우 2단으로 나란히 두어 비교하며 입력한다 */

import { useT } from '@/lib/i18n/useT';
import type { FieldGroupProps } from './types';

export default function DescriptionFields({ formData, onChange }: FieldGroupProps) {
  const t = useT();

  return (
    <div className="admin-form-bilingual">
      <div className="admin-form-group">
        <label htmlFor="description_ko" className="admin-form-label">
          {t('admin.events.fieldDescKo', '설명 (한글)')}
        </label>
        <textarea
          id="description_ko"
          name="description_ko"
          value={formData.description_ko}
          onChange={onChange}
          rows={5}
          className="admin-form-textarea"
        />
      </div>

      <div className="admin-form-group">
        <label htmlFor="description_en" className="admin-form-label">
          {t('admin.events.fieldDescEn', '설명 (영문)')}
        </label>
        <textarea
          id="description_en"
          name="description_en"
          value={formData.description_en}
          onChange={onChange}
          rows={5}
          className="admin-form-textarea"
        />
      </div>
    </div>
  );
}
