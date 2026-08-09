'use client';

/**
 * 운영 시간 — 켠 요일만 시간이 저장되고, 꺼진 요일은 휴무로 간주된다
 *
 * 요일 이름은 상수(BUSINESS_DAYS)의 한국어를 폴백으로 두고 키코드로 번역한다.
 */

import { BUSINESS_DAYS, type BusinessDayKey } from '@/lib/seoBusiness';
import { useT } from '@/lib/i18n/useT';

export interface HoursRow {
  open: boolean;
  opens: string;
  closes: string;
}

export type HoursState = Record<BusinessDayKey, HoursRow>;

interface SeoHoursFieldsProps {
  hoursState: HoursState;
  onSetHour: (day: BusinessDayKey, patch: Partial<HoursRow>) => void;
  saving: boolean;
}

export default function SeoHoursFields({ hoursState, onSetHour, saving }: SeoHoursFieldsProps) {
  const t = useT();

  return (
    <section className="admin-form-section admin-account-card">
      <h2 className="admin-form-section-title">{t('admin.seo.hoursTitle', '운영 시간')}</h2>
      <p className="admin-form-help">
        {t(
          'admin.seo.hoursHelp',
          '운영하는 요일만 켜고 시간을 입력하세요. 꺼진 요일은 휴무로 간주됩니다.'
        )}
      </p>
      <div className="admin-seo-hours">
        {BUSINESS_DAYS.map(({ key, ko }) => {
          const row = hoursState[key];
          const dayName = t(`admin.seo.day.${key}`, `${ko}요일`);
          return (
            <div key={key} className={`admin-seo-hours-row${row.open ? '' : ' is-closed'}`}>
              <label className="admin-seo-hours-day">
                <input
                  type="checkbox"
                  checked={row.open}
                  onChange={(e) => onSetHour(key, { open: e.target.checked })}
                  disabled={saving}
                />
                <span>{dayName}</span>
              </label>
              <input
                type="time"
                className="admin-form-input admin-form-input-sm"
                value={row.opens}
                onChange={(e) => onSetHour(key, { opens: e.target.value })}
                disabled={saving || !row.open}
                aria-label={t('admin.seo.dayOpens', '{day} 시작', { day: dayName })}
              />
              <span className="admin-seo-hours-sep">–</span>
              <input
                type="time"
                className="admin-form-input admin-form-input-sm"
                value={row.closes}
                onChange={(e) => onSetHour(key, { closes: e.target.value })}
                disabled={saving || !row.open}
                aria-label={t('admin.seo.dayCloses', '{day} 종료', { day: dayName })}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
