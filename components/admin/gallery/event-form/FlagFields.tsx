'use client';

/**
 * 노출 플래그 — 공개 / 추천 / 공연 쇼케이스
 *
 * 쇼케이스는 공연(/performances) 전용이라 학내 행사에서는 통째로 감춘다.
 * 감춘 값이 남아 있어도 저장 시 서버로 가는 body에서 강제로 꺼진다(useEventForm 참고).
 */

import { useT } from '@/lib/i18n/useT';
import type { FieldGroupProps } from './types';

export default function FlagFields({ formData, onChange }: FieldGroupProps) {
  const t = useT();

  return (
    <>
      <div className="admin-form-row">
        <div className="admin-form-checkbox">
          <input
            type="checkbox"
            id="is_published"
            name="is_published"
            checked={formData.is_published}
            onChange={onChange}
          />
          <label htmlFor="is_published">
            {t('admin.events.publishLabel', '공개 Gallery에 표시')}
          </label>
        </div>

        <div className="admin-form-checkbox">
          <input
            type="checkbox"
            id="is_featured"
            name="is_featured"
            checked={formData.is_featured}
            onChange={onChange}
          />
          <label htmlFor="is_featured">{t('admin.events.featuredLabel', '추천')}</label>
        </div>
      </div>

      {formData.kind !== 'school' && (
        <div className="admin-form-row">
          <div className="admin-form-checkbox">
            <input
              type="checkbox"
              id="is_signature"
              name="is_signature"
              checked={formData.is_signature}
              onChange={onChange}
            />
            <label htmlFor="is_signature">
              {t('admin.events.signatureLabel', '공연(/performances) 쇼케이스에 표시')}
            </label>
          </div>

          <div className="admin-form-group">
            <label htmlFor="signature_order" className="admin-form-label">
              {t('admin.events.signatureOrder', '쇼케이스 순서 (작을수록 먼저)')}
            </label>
            <input
              type="number"
              id="signature_order"
              name="signature_order"
              value={formData.signature_order}
              onChange={onChange}
              className="admin-form-input"
              min={0}
            />
          </div>
        </div>
      )}
    </>
  );
}
