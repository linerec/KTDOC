'use client';

/**
 * 주소(Address)와 좌표 — NAP의 A
 *
 * 주소 4개(도로명·시·주·우편번호)가 다 차야 검색엔진에 지역 업체로 올라간다.
 * 좌표는 선택이지만 구글 권장이며, 주소를 다 채운 뒤 버튼 한 번으로 채울 수 있다.
 */

import { useT } from '@/lib/i18n/useT';
import type { SeoFieldsProps } from './types';

interface SeoAddressFieldsProps extends SeoFieldsProps {
  onGeocode: () => void;
  geocoding: boolean;
}

export default function SeoAddressFields({
  info,
  onSet,
  saving,
  onGeocode,
  geocoding,
}: SeoAddressFieldsProps) {
  const t = useT();

  return (
    <section className="admin-form-section admin-account-card">
      <h2 className="admin-form-section-title">{t('admin.seo.addressTitle', '주소 (Address)')}</h2>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="seo-street">
          {t('admin.seo.street', '도로명 주소')}
        </label>
        <input
          id="seo-street"
          type="text"
          className="admin-form-input"
          value={info.streetAddress}
          onChange={(e) => onSet('streetAddress', e.target.value)}
          maxLength={120}
          placeholder={t('admin.seo.streetPlaceholder', '예: 123 Broad Ave Suite 200')}
          disabled={saving}
        />
      </div>

      <div className="admin-seo-row admin-seo-row-4">
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-city">
            {t('admin.seo.city', '시 (City)')}
          </label>
          <input
            id="seo-city"
            type="text"
            className="admin-form-input"
            value={info.addressLocality}
            onChange={(e) => onSet('addressLocality', e.target.value)}
            maxLength={60}
            placeholder={t('admin.seo.cityPlaceholder', '예: Palisades Park')}
            disabled={saving}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-region">
            {t('admin.seo.region', '주 (State)')}
          </label>
          <input
            id="seo-region"
            type="text"
            className="admin-form-input"
            value={info.addressRegion}
            onChange={(e) => onSet('addressRegion', e.target.value)}
            maxLength={20}
            placeholder="NJ"
            disabled={saving}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-zip">
            {t('admin.seo.postalCode', '우편번호')}
          </label>
          <input
            id="seo-zip"
            type="text"
            className="admin-form-input"
            value={info.postalCode}
            onChange={(e) => onSet('postalCode', e.target.value)}
            maxLength={12}
            placeholder="07650"
            disabled={saving}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-country">
            {t('admin.seo.country', '국가 코드')}
          </label>
          <input
            id="seo-country"
            type="text"
            className="admin-form-input"
            value={info.addressCountry}
            onChange={(e) => onSet('addressCountry', e.target.value)}
            maxLength={2}
            placeholder="US"
            disabled={saving}
          />
        </div>
      </div>

      <div className="admin-seo-row">
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-lat">
            {t('admin.seo.latitude', '위도 (Latitude)')}
          </label>
          <input
            id="seo-lat"
            type="text"
            inputMode="decimal"
            className="admin-form-input"
            value={info.latitude}
            onChange={(e) => onSet('latitude', e.target.value)}
            maxLength={20}
            placeholder="40.848100"
            disabled={saving}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-lng">
            {t('admin.seo.longitude', '경도 (Longitude)')}
          </label>
          <input
            id="seo-lng"
            type="text"
            inputMode="decimal"
            className="admin-form-input"
            value={info.longitude}
            onChange={(e) => onSet('longitude', e.target.value)}
            maxLength={20}
            placeholder="-73.997700"
            disabled={saving}
          />
        </div>
      </div>
      <div className="admin-domain-actions">
        <button
          type="button"
          className="admin-btn admin-btn-outline admin-btn-sm"
          onClick={onGeocode}
          disabled={saving || geocoding}
        >
          {geocoding
            ? t('admin.location.searching', '검색 중…')
            : t('admin.seo.geocode', '주소로 좌표 찾기')}
        </button>
      </div>
      <p className="admin-form-help">
        {t(
          'admin.seo.coordsHelp',
          '좌표는 선택 항목이지만 구글 권장 항목입니다(소수점 5자리 이상). 위 주소를 모두 입력한 뒤 버튼을 누르면 자동으로 채워집니다.'
        )}
      </p>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="seo-gmaps">
          {t('admin.seo.googleMaps', '구글 지도 링크')}
        </label>
        <input
          id="seo-gmaps"
          type="url"
          className="admin-form-input"
          value={info.googleMaps}
          onChange={(e) => onSet('googleMaps', e.target.value)}
          maxLength={300}
          placeholder="https://maps.google.com/?cid=..."
          disabled={saving}
        />
        <p className="admin-form-help">
          {t(
            'admin.seo.googleMapsHelp',
            '구글 비즈니스 프로필의 “지도 공유” 링크. 푸터 주소를 누르면 이 지도로 연결됩니다.'
          )}
        </p>
      </div>
    </section>
  );
}
