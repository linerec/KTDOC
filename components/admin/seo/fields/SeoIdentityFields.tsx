'use client';

/** 상호(Name)와 소개문 — NAP의 N */

import { useT } from '@/lib/i18n/useT';
import type { SeoFieldsProps } from './types';

export default function SeoIdentityFields({ info, onSet, saving }: SeoFieldsProps) {
  const t = useT();

  return (
    <section className="admin-form-section admin-account-card">
      <h2 className="admin-form-section-title">{t('admin.seo.identityTitle', '상호 · 소개')}</h2>

      <div className="admin-seo-row">
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-name-ko">
            {t('admin.seo.nameKo', '상호(한글)')} <span className="required">*</span>
          </label>
          <input
            id="seo-name-ko"
            type="text"
            className="admin-form-input"
            value={info.nameKo}
            onChange={(e) => onSet('nameKo', e.target.value)}
            maxLength={80}
            placeholder="춤누리 한국전통무용학원"
            disabled={saving}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-name-en">
            {t('admin.seo.nameEn', '상호(영문)')} <span className="required">*</span>
          </label>
          <input
            id="seo-name-en"
            type="text"
            className="admin-form-input"
            value={info.nameEn}
            onChange={(e) => onSet('nameEn', e.target.value)}
            maxLength={120}
            placeholder="Korean Traditional Dance of Choomnoori"
            disabled={saving}
          />
          <p className="admin-form-help">
            {t('admin.seo.nameEnHelp', '구글 비즈니스 프로필의 업체명과 동일하게 입력하세요.')}
          </p>
        </div>
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="seo-desc-ko">
          {t('admin.seo.descKo', '소개문(한글)')}
        </label>
        <textarea
          id="seo-desc-ko"
          className="admin-form-input"
          value={info.descriptionKo}
          onChange={(e) => onSet('descriptionKo', e.target.value)}
          maxLength={300}
          rows={2}
          placeholder={t(
            'admin.seo.descKoPlaceholder',
            '예: 뉴저지에 위치한 한국 전통무용 교육기관으로, 어린이·청소년·성인 대상 수업과 공연을 운영합니다.'
          )}
          disabled={saving}
        />
      </div>
      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="seo-desc-en">
          {t('admin.seo.descEn', '소개문(영문)')}
        </label>
        <textarea
          id="seo-desc-en"
          className="admin-form-input"
          value={info.descriptionEn}
          onChange={(e) => onSet('descriptionEn', e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="e.g. A Korean traditional dance academy in New Jersey offering classes and performances for all ages."
          disabled={saving}
        />
        <p className="admin-form-help">
          {t('admin.seo.descEnHelp', '검색엔진용 구조화 데이터에는 영문 소개문이 우선 사용됩니다.')}
        </p>
      </div>
    </section>
  );
}
