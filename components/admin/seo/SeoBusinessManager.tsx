'use client';

/**
 * SeoBusinessManager — SEO · 사이트 정보(NAP) 입력 폼(관리자).
 *
 * 여기서 저장한 값이 (1) 모든 페이지 푸터의 연락처 블록, (2) <head>의
 * LocalBusiness JSON-LD 구조화 데이터에 동시에 반영된다(단일 진실의 원천).
 * 저장은 /api/admin/settings ('seo.business').
 *
 * 이 파일은 상태와 저장·좌표찾기만 맡고, 화면은 fields/ 아래 조각들이 그린다
 * (체크리스트 · 상호 · 주소 · 연락처 · 운영시간 · 노출정보 · 미리보기).
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BUSINESS_DAYS,
  SETTING_SEO_BUSINESS,
  buildBusinessJsonLd,
  hasFullAddress,
  type BusinessDayKey,
  type BusinessHoursEntry,
  type SeoBusinessInfo,
} from '@/lib/seoBusiness';
import { useT } from '@/lib/i18n/useT';
import SeoChecklist from './fields/SeoChecklist';
import SeoIdentityFields from './fields/SeoIdentityFields';
import SeoAddressFields from './fields/SeoAddressFields';
import SeoContactFields from './fields/SeoContactFields';
import SeoHoursFields, { type HoursRow, type HoursState } from './fields/SeoHoursFields';
import SeoExposureFields from './fields/SeoExposureFields';
import SeoPreviewSave from './fields/SeoPreviewSave';

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
  const t = useT();

  const [info, setInfo] = useState<SeoBusinessInfo>(initialInfo);
  const [hoursState, setHoursState] = useState<HoursState>(() => toHoursState(initialInfo.hours));
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const set = <K extends keyof SeoBusinessInfo>(key: K, value: SeoBusinessInfo[K]) =>
    setInfo((prev) => ({ ...prev, [key]: value }));

  const setHour = (day: BusinessDayKey, patch: Partial<HoursRow>) =>
    setHoursState((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  // 현재 입력값 기준 미리보기(저장 전 상태 반영)
  const draft: SeoBusinessInfo = useMemo(
    () => ({ ...info, hours: toHoursEntries(hoursState) }),
    [info, hoursState]
  );
  const jsonLdPreview = useMemo(
    () => JSON.stringify(buildBusinessJsonLd(draft), null, 2),
    [draft]
  );

  async function handleGeocode() {
    setError('');
    if (!hasFullAddress(draft)) {
      setError(
        t(
          'admin.seo.geocodeNeedAddress',
          '좌표를 찾으려면 먼저 주소 4개 항목(도로명·시·주·우편번호)을 입력해 주세요.'
        )
      );
      return;
    }
    setGeocoding(true);
    try {
      const q = `${draft.streetAddress}, ${draft.addressLocality}, ${draft.addressRegion} ${draft.postalCode}`;
      const res = await fetch(`/api/admin/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const first = data?.data?.[0];
      if (!res.ok || !data.success || !first) {
        setError(
          t(
            'admin.seo.geocodeFailed',
            '주소로 좌표를 찾지 못했습니다. 주소를 확인하거나 좌표를 직접 입력해 주세요.'
          )
        );
        return;
      }
      setInfo((prev) => ({
        ...prev,
        latitude: Number(first.lat).toFixed(6),
        longitude: Number(first.lng).toFixed(6),
      }));
    } catch {
      setError(t('admin.seo.geocodeError', '좌표 검색 중 오류가 발생했습니다.'));
    } finally {
      setGeocoding(false);
    }
  }

  async function handleSave() {
    setError('');
    setResult('');

    if (!info.nameKo.trim() || !info.nameEn.trim()) {
      setError(t('admin.seo.needNames', '상호(한글·영문)를 모두 입력해 주세요.'));
      return;
    }
    if ((info.latitude && !info.longitude) || (!info.latitude && info.longitude)) {
      setError(t('admin.seo.needBothCoords', '좌표는 위도·경도를 함께 입력하거나 둘 다 비워 주세요.'));
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
        setError(data.error || t('admin.common.saveFailed', '저장에 실패했습니다.'));
        return;
      }
      setResult(
        t('admin.seo.saved', '저장했습니다. 모든 페이지의 푸터와 구조화 데이터에 즉시 반영됩니다.')
      );
      router.refresh();
    } catch {
      setError(t('admin.notify.serverError', '서버 오류가 발생했습니다.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-seo-layout">
      <SeoChecklist />
      <SeoIdentityFields info={info} onSet={set} saving={saving} />
      <SeoAddressFields
        info={info}
        onSet={set}
        saving={saving}
        onGeocode={handleGeocode}
        geocoding={geocoding}
      />
      <SeoContactFields info={info} onSet={set} saving={saving} />
      <SeoHoursFields hoursState={hoursState} onSetHour={setHour} saving={saving} />
      <SeoExposureFields info={info} onSet={set} saving={saving} />
      <SeoPreviewSave
        draft={draft}
        jsonLdPreview={jsonLdPreview}
        error={error}
        result={result}
        saving={saving}
        onSave={handleSave}
      />
    </div>
  );
}
