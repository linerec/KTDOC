'use client';

/**
 * 노출 플래그 — 공개 / 추천 / 공연 페이지(/performances) 노출
 *
 * 공연 페이지 노출은 두 가지가 따로 논다(2026-09-10 결정):
 *  - 대표 공연(Signature Works) = 맨 위 큰 배너. 켜고 끄는 플래그. 여럿이면 슬라이드쇼.
 *  - 레퍼토리 목록 표시(is_signature) + 목록 순서(signature_order). 순서는 목록 안에서만.
 * 예전엔 순서 숫자가 배너까지 정해서 "하나만 1을 주라"는 규칙을 사람이 기억해야 했다.
 *
 * 학내 행사에서는 공연 페이지 카드를 통째로 감춘다. 감춘 값이 남아 있어도 저장 시
 * 서버로 가는 body에서 강제로 꺼진다(useEventForm 참고).
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
        <fieldset className="stage-card">
          <legend className="stage-card-legend">
            {t('admin.events.stage.legend', '공연 페이지(/performances) 노출')}
          </legend>

          <label className={`stage-option${formData.is_hero ? ' is-on' : ''}`} htmlFor="is_hero">
            <input
              type="checkbox"
              id="is_hero"
              name="is_hero"
              checked={formData.is_hero}
              onChange={onChange}
            />
            <span className="stage-option-body">
              <span className="stage-option-title">
                {t('admin.events.heroLabel', '대표 공연 · Signature Works')}
              </span>
              <span className="stage-option-help">
                {t(
                  'admin.events.heroHelp',
                  '페이지 맨 위 큰 배너에 섭니다. 여러 공연을 켜면 배너가 자동으로 넘어가는 슬라이드쇼가 됩니다.'
                )}
              </span>
            </span>
          </label>

          <label
            className={`stage-option${formData.is_signature ? ' is-on' : ''}`}
            htmlFor="is_signature"
          >
            <input
              type="checkbox"
              id="is_signature"
              name="is_signature"
              checked={formData.is_signature}
              onChange={onChange}
            />
            <span className="stage-option-body">
              <span className="stage-option-title">
                {t('admin.events.signatureLabel', '레퍼토리 목록에 표시')}
              </span>
              <span className="stage-option-help">
                {t(
                  'admin.events.signatureHelp',
                  '배너 아래, 분류별 공연 목록에 카드로 나옵니다.'
                )}
              </span>
              {formData.is_signature && (
                <span className="stage-option-order">
                  <label htmlFor="signature_order">
                    {t('admin.events.signatureOrder', '목록 순서')}
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
                  <span className="stage-option-help">
                    {t('admin.events.signatureOrderHelp', '1이 맨 앞. 0이면 자동(최근 공연순).')}
                  </span>
                </span>
              )}
            </span>
          </label>
        </fieldset>
      )}
    </>
  );
}
