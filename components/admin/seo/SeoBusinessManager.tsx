'use client';

/**
 * SeoBusinessManager — SEO · 사이트 정보(NAP) 입력 폼(관리자).
 *
 * 여기서 저장한 값이 (1) 모든 페이지 푸터의 연락처 블록, (2) <head>의
 * LocalBusiness JSON-LD 구조화 데이터에 동시에 반영된다(단일 진실의 원천).
 * 저장은 /api/admin/settings ('seo.business').
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BUSINESS_DAYS,
  SETTING_SEO_BUSINESS,
  buildBusinessJsonLd,
  formatAddressLine,
  hasFullAddress,
  type BusinessDayKey,
  type BusinessHoursEntry,
  type SeoBusinessInfo,
} from '@/lib/seoBusiness';

type HoursState = Record<BusinessDayKey, { open: boolean; opens: string; closes: string }>;

function toHoursState(hours: BusinessHoursEntry[]): HoursState {
  const state = {} as HoursState;
  for (const { key } of BUSINESS_DAYS) {
    const entry = hours.find((h) => h.day === key);
    state[key] = entry
      ? { open: true, opens: entry.opens, closes: entry.closes }
      : { open: false, opens: '16:00', closes: '20:00' };
  }
  return state;
}

function toHoursEntries(state: HoursState): BusinessHoursEntry[] {
  return BUSINESS_DAYS.filter(({ key }) => state[key].open).map(({ key }) => ({
    day: key,
    opens: state[key].opens,
    closes: state[key].closes,
  }));
}

export default function SeoBusinessManager({ initialInfo }: { initialInfo: SeoBusinessInfo }) {
  const router = useRouter();

  const [info, setInfo] = useState<SeoBusinessInfo>(initialInfo);
  const [hoursState, setHoursState] = useState<HoursState>(() => toHoursState(initialInfo.hours));
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const set = <K extends keyof SeoBusinessInfo>(key: K, value: SeoBusinessInfo[K]) =>
    setInfo((prev) => ({ ...prev, [key]: value }));

  const setHour = (day: BusinessDayKey, patch: Partial<HoursState[BusinessDayKey]>) =>
    setHoursState((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  // 현재 입력값 기준 미리보기(저장 전 상태 반영)
  const draft: SeoBusinessInfo = useMemo(
    () => ({ ...info, hours: toHoursEntries(hoursState) }),
    [info, hoursState]
  );
  const addressLine = formatAddressLine(draft);
  const jsonLdPreview = useMemo(
    () => JSON.stringify(buildBusinessJsonLd(draft), null, 2),
    [draft]
  );

  async function handleGeocode() {
    setError('');
    if (!hasFullAddress(draft)) {
      setError('좌표를 찾으려면 먼저 주소 4개 항목(도로명·시·주·우편번호)을 입력해 주세요.');
      return;
    }
    setGeocoding(true);
    try {
      const q = `${draft.streetAddress}, ${draft.addressLocality}, ${draft.addressRegion} ${draft.postalCode}`;
      const res = await fetch(`/api/admin/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const first = data?.data?.[0];
      if (!res.ok || !data.success || !first) {
        setError('주소로 좌표를 찾지 못했습니다. 주소를 확인하거나 좌표를 직접 입력해 주세요.');
        return;
      }
      setInfo((prev) => ({
        ...prev,
        latitude: Number(first.lat).toFixed(6),
        longitude: Number(first.lng).toFixed(6),
      }));
    } catch {
      setError('좌표 검색 중 오류가 발생했습니다.');
    } finally {
      setGeocoding(false);
    }
  }

  async function handleSave() {
    setError('');
    setResult('');

    if (!info.nameKo.trim() || !info.nameEn.trim()) {
      setError('상호(한글·영문)를 모두 입력해 주세요.');
      return;
    }
    if ((info.latitude && !info.longitude) || (!info.latitude && info.longitude)) {
      setError('좌표는 위도·경도를 함께 입력하거나 둘 다 비워 주세요.');
      return;
    }

    setSaving(true);
    try {
      const value = JSON.stringify({ ...draft });
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SETTING_SEO_BUSINESS, value }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || '저장에 실패했습니다.');
        return;
      }
      setResult('저장했습니다. 모든 페이지의 푸터와 구조화 데이터에 즉시 반영됩니다.');
      router.refresh();
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-seo-layout">
      {/* 체크리스트 안내 */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">지역 검색(로컬 SEO) 체크리스트</h2>
        <ul className="admin-seo-checklist">
          <li>
            <strong>NAP 일관성</strong> — 상호(Name)·주소(Address)·전화(Phone)는
            구글 비즈니스 프로필, 이 사이트, 다른 디렉터리(Yelp 등)에서 글자 단위로 동일해야 합니다.
            &ldquo;Suite 200&rdquo;과 &ldquo;Ste 200&rdquo;처럼 표기가 갈리면 안 됩니다.
          </li>
          <li>
            <strong>주소·전화 필수</strong> — 주소 4개 항목이 채워지면 검색엔진에
            LocalBusiness(지역 업체)로 게시되고, 비어 있는 동안은 Organization 수준으로만 게시됩니다.
          </li>
          <li>
            <strong>전화 형식</strong> — 국가·지역번호 포함 <code>+1-201-555-0123</code> 형식을 권장합니다.
          </li>
          <li>
            <strong>운영시간·좌표</strong> — 구글 권장 항목입니다. 채울수록 검색 노출 품질이 올라갑니다.
          </li>
        </ul>
      </section>

      {/* 상호·소개 */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">상호 · 소개</h2>

        <div className="admin-seo-row">
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-name-ko">
              상호(한글) <span className="required">*</span>
            </label>
            <input
              id="seo-name-ko"
              type="text"
              className="admin-form-input"
              value={info.nameKo}
              onChange={(e) => set('nameKo', e.target.value)}
              maxLength={80}
              placeholder="춤누리 한국전통무용학원"
              disabled={saving}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-name-en">
              상호(영문) <span className="required">*</span>
            </label>
            <input
              id="seo-name-en"
              type="text"
              className="admin-form-input"
              value={info.nameEn}
              onChange={(e) => set('nameEn', e.target.value)}
              maxLength={120}
              placeholder="Korean Traditional Dance of Choomnoori"
              disabled={saving}
            />
            <p className="admin-form-help">구글 비즈니스 프로필의 업체명과 동일하게 입력하세요.</p>
          </div>
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-desc-ko">소개문(한글)</label>
          <textarea
            id="seo-desc-ko"
            className="admin-form-input"
            value={info.descriptionKo}
            onChange={(e) => set('descriptionKo', e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="예: 뉴저지에 위치한 한국 전통무용 교육기관으로, 어린이·청소년·성인 대상 수업과 공연을 운영합니다."
            disabled={saving}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-desc-en">소개문(영문)</label>
          <textarea
            id="seo-desc-en"
            className="admin-form-input"
            value={info.descriptionEn}
            onChange={(e) => set('descriptionEn', e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="e.g. A Korean traditional dance academy in New Jersey offering classes and performances for all ages."
            disabled={saving}
          />
          <p className="admin-form-help">검색엔진용 구조화 데이터에는 영문 소개문이 우선 사용됩니다.</p>
        </div>
      </section>

      {/* 주소(NAP) */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">주소 (Address)</h2>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-street">도로명 주소</label>
          <input
            id="seo-street"
            type="text"
            className="admin-form-input"
            value={info.streetAddress}
            onChange={(e) => set('streetAddress', e.target.value)}
            maxLength={120}
            placeholder="예: 123 Broad Ave Suite 200"
            disabled={saving}
          />
        </div>

        <div className="admin-seo-row admin-seo-row-4">
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-city">시 (City)</label>
            <input
              id="seo-city"
              type="text"
              className="admin-form-input"
              value={info.addressLocality}
              onChange={(e) => set('addressLocality', e.target.value)}
              maxLength={60}
              placeholder="예: Palisades Park"
              disabled={saving}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-region">주 (State)</label>
            <input
              id="seo-region"
              type="text"
              className="admin-form-input"
              value={info.addressRegion}
              onChange={(e) => set('addressRegion', e.target.value)}
              maxLength={20}
              placeholder="NJ"
              disabled={saving}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-zip">우편번호</label>
            <input
              id="seo-zip"
              type="text"
              className="admin-form-input"
              value={info.postalCode}
              onChange={(e) => set('postalCode', e.target.value)}
              maxLength={12}
              placeholder="07650"
              disabled={saving}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-country">국가 코드</label>
            <input
              id="seo-country"
              type="text"
              className="admin-form-input"
              value={info.addressCountry}
              onChange={(e) => set('addressCountry', e.target.value)}
              maxLength={2}
              placeholder="US"
              disabled={saving}
            />
          </div>
        </div>

        <div className="admin-seo-row">
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-lat">위도 (Latitude)</label>
            <input
              id="seo-lat"
              type="text"
              inputMode="decimal"
              className="admin-form-input"
              value={info.latitude}
              onChange={(e) => set('latitude', e.target.value)}
              maxLength={20}
              placeholder="40.848100"
              disabled={saving}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-lng">경도 (Longitude)</label>
            <input
              id="seo-lng"
              type="text"
              inputMode="decimal"
              className="admin-form-input"
              value={info.longitude}
              onChange={(e) => set('longitude', e.target.value)}
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
            onClick={handleGeocode}
            disabled={saving || geocoding}
          >
            {geocoding ? '검색 중…' : '주소로 좌표 찾기'}
          </button>
        </div>
        <p className="admin-form-help">
          좌표는 선택 항목이지만 구글 권장 항목입니다(소수점 5자리 이상).
          위 주소를 모두 입력한 뒤 버튼을 누르면 자동으로 채워집니다.
        </p>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-gmaps">구글 지도 링크</label>
          <input
            id="seo-gmaps"
            type="url"
            className="admin-form-input"
            value={info.googleMaps}
            onChange={(e) => set('googleMaps', e.target.value)}
            maxLength={300}
            placeholder="https://maps.google.com/?cid=..."
            disabled={saving}
          />
          <p className="admin-form-help">
            구글 비즈니스 프로필의 &ldquo;지도 공유&rdquo; 링크. 푸터 주소를 누르면 이 지도로 연결됩니다.
          </p>
        </div>
      </section>

      {/* 연락처 */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">연락처 (Phone · Email)</h2>
        <div className="admin-seo-row">
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-tel">대표 전화</label>
            <input
              id="seo-tel"
              type="tel"
              className="admin-form-input"
              value={info.telephone}
              onChange={(e) => set('telephone', e.target.value)}
              maxLength={30}
              placeholder="+1-201-555-0123"
              disabled={saving}
            />
            <p className="admin-form-help">구글 비즈니스 프로필과 동일한 번호·형식으로.</p>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-email">대표 이메일</label>
            <input
              id="seo-email"
              type="email"
              className="admin-form-input"
              value={info.email}
              onChange={(e) => set('email', e.target.value)}
              maxLength={120}
              placeholder="info@ktdoc.org"
              disabled={saving}
            />
          </div>
        </div>
      </section>

      {/* 운영 시간 */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">운영 시간</h2>
        <p className="admin-form-help">
          운영하는 요일만 켜고 시간을 입력하세요. 꺼진 요일은 휴무로 간주됩니다.
        </p>
        <div className="admin-seo-hours">
          {BUSINESS_DAYS.map(({ key, ko }) => {
            const row = hoursState[key];
            return (
              <div key={key} className={`admin-seo-hours-row${row.open ? '' : ' is-closed'}`}>
                <label className="admin-seo-hours-day">
                  <input
                    type="checkbox"
                    checked={row.open}
                    onChange={(e) => setHour(key, { open: e.target.checked })}
                    disabled={saving}
                  />
                  <span>{ko}요일</span>
                </label>
                <input
                  type="time"
                  className="admin-form-input admin-form-input-sm"
                  value={row.opens}
                  onChange={(e) => setHour(key, { opens: e.target.value })}
                  disabled={saving || !row.open}
                  aria-label={`${ko}요일 시작`}
                />
                <span className="admin-seo-hours-sep">–</span>
                <input
                  type="time"
                  className="admin-form-input admin-form-input-sm"
                  value={row.closes}
                  onChange={(e) => setHour(key, { closes: e.target.value })}
                  disabled={saving || !row.open}
                  aria-label={`${ko}요일 종료`}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* 노출 정보 · SNS */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">노출 정보 · SNS</h2>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-area">서비스 지역</label>
          <input
            id="seo-area"
            type="text"
            className="admin-form-input"
            value={info.areaServed}
            onChange={(e) => set('areaServed', e.target.value)}
            maxLength={200}
            placeholder="예: Palisades Park, Fort Lee, Bergen County"
            disabled={saving}
          />
          <p className="admin-form-help">쉼표로 구분한 지역 이름. 학생들이 통학해 오는 인근 도시를 적으세요.</p>
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-price">가격대</label>
          <input
            id="seo-price"
            type="text"
            className="admin-form-input admin-form-input-sm"
            value={info.priceRange}
            onChange={(e) => set('priceRange', e.target.value)}
            maxLength={20}
            placeholder="$$"
            disabled={saving}
          />
          <p className="admin-form-help">선택 항목. 보통 $(저렴)~$$$$(고가) 기호로 표기합니다.</p>
        </div>

        <div className="admin-seo-row">
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-insta">인스타그램 URL</label>
            <input
              id="seo-insta"
              type="url"
              className="admin-form-input"
              value={info.instagram}
              onChange={(e) => set('instagram', e.target.value)}
              maxLength={200}
              disabled={saving}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="seo-youtube">유튜브 URL</label>
            <input
              id="seo-youtube"
              type="url"
              className="admin-form-input"
              value={info.youtube}
              onChange={(e) => set('youtube', e.target.value)}
              maxLength={200}
              disabled={saving}
            />
          </div>
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-kakao">카카오톡 채널 URL</label>
          <input
            id="seo-kakao"
            type="url"
            className="admin-form-input"
            value={info.kakao}
            onChange={(e) => set('kakao', e.target.value)}
            placeholder="https://pf.kakao.com/_채널ID"
            maxLength={200}
            disabled={saving}
          />
          <p className="admin-form-help">
            입력하면 로그인·가입·Q&A·푸터의 문의 버튼에 카카오톡이 함께 노출됩니다.
            카카오톡 채널 관리자센터에서 채널 홈 URL을 복사해 붙여 주세요.
          </p>
        </div>
      </section>

      {/* 미리보기 · 저장 */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">미리보기 · 저장</h2>

        <div className={`admin-cal-status${hasFullAddress(draft) ? ' is-on' : ' is-off'}`}>
          <span className="admin-cal-status-dot" aria-hidden="true" />
          {hasFullAddress(draft) ? (
            <span>
              주소 완성 — 검색엔진에 <strong>LocalBusiness</strong>(지역 업체)로 게시됩니다.
              {' '}푸터 표기: {addressLine}
            </span>
          ) : (
            <span>
              주소가 아직 완성되지 않아 <strong>Organization</strong> 수준으로만 게시됩니다.
              도로명·시·주·우편번호 4개를 채우면 지역 업체로 승격됩니다.
            </span>
          )}
        </div>

        <details className="admin-seo-jsonld">
          <summary>구조화 데이터(JSON-LD) 미리보기</summary>
          <pre>{jsonLdPreview}</pre>
        </details>

        {error && (
          <p className="admin-account-feedback admin-account-feedback--error" role="alert">{error}</p>
        )}
        {result && (
          <p className="admin-account-feedback admin-account-feedback--success" role="status">{result}</p>
        )}

        <div className="admin-domain-actions">
          <button type="button" className="admin-btn admin-btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '사이트 정보 저장'}
          </button>
        </div>
      </section>
    </div>
  );
}
