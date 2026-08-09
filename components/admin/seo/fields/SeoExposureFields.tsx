'use client';

/** 서비스 지역·가격대·SNS — 검색 노출을 거드는 보조 정보 */

import { useT } from '@/lib/i18n/useT';
import type { SeoFieldsProps } from './types';

export default function SeoExposureFields({ info, onSet, saving }: SeoFieldsProps) {
  const t = useT();

  return (
    <section className="admin-form-section admin-account-card">
      <h2 className="admin-form-section-title">{t('admin.seo.exposureTitle', '노출 정보 · SNS')}</h2>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="seo-area">
          {t('admin.seo.areaServed', '서비스 지역')}
        </label>
        <input
          id="seo-area"
          type="text"
          className="admin-form-input"
          value={info.areaServed}
          onChange={(e) => onSet('areaServed', e.target.value)}
          maxLength={200}
          placeholder={t('admin.seo.areaPlaceholder', '예: Palisades Park, Fort Lee, Bergen County')}
          disabled={saving}
        />
        <p className="admin-form-help">
          {t(
            'admin.seo.areaHelp',
            '쉼표로 구분한 지역 이름. 학생들이 통학해 오는 인근 도시를 적으세요.'
          )}
        </p>
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="seo-price">
          {t('admin.seo.priceRange', '가격대')}
        </label>
        <input
          id="seo-price"
          type="text"
          className="admin-form-input admin-form-input-sm"
          value={info.priceRange}
          onChange={(e) => onSet('priceRange', e.target.value)}
          maxLength={20}
          placeholder="$$"
          disabled={saving}
        />
        <p className="admin-form-help">
          {t('admin.seo.priceHelp', '선택 항목. 보통 $(저렴)~$$$$(고가) 기호로 표기합니다.')}
        </p>
      </div>

      <div className="admin-seo-row">
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-insta">
            {t('admin.seo.instagram', '인스타그램 URL')}
          </label>
          <input
            id="seo-insta"
            type="url"
            className="admin-form-input"
            value={info.instagram}
            onChange={(e) => onSet('instagram', e.target.value)}
            maxLength={200}
            disabled={saving}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-youtube">
            {t('admin.seo.youtube', '유튜브 URL')}
          </label>
          <input
            id="seo-youtube"
            type="url"
            className="admin-form-input"
            value={info.youtube}
            onChange={(e) => onSet('youtube', e.target.value)}
            maxLength={200}
            disabled={saving}
          />
        </div>
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="seo-kakao">
          {t('admin.seo.kakao', '카카오톡 채널 URL')}
        </label>
        <input
          id="seo-kakao"
          type="url"
          className="admin-form-input"
          value={info.kakao}
          onChange={(e) => onSet('kakao', e.target.value)}
          placeholder="https://pf.kakao.com/_채널ID"
          maxLength={200}
          disabled={saving}
        />
        <p className="admin-form-help">
          {t(
            'admin.seo.kakaoHelp',
            '입력하면 로그인·가입·Q&A·푸터의 문의 버튼에 카카오톡이 함께 노출됩니다. 카카오톡 채널 관리자센터에서 채널 홈 URL을 복사해 붙여 주세요.'
          )}
        </p>
      </div>
    </section>
  );
}
