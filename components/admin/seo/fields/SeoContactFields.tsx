'use client';

/** 연락처(Phone·Email) — NAP의 P */

import { useT } from '@/lib/i18n/useT';
import type { SeoFieldsProps } from './types';

export default function SeoContactFields({ info, onSet, saving }: SeoFieldsProps) {
  const t = useT();

  return (
    <section className="admin-form-section admin-account-card">
      <h2 className="admin-form-section-title">
        {t('admin.seo.contactTitle', '연락처 (Phone · Email)')}
      </h2>
      <div className="admin-seo-row">
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-tel">
            {t('admin.seo.phone', '대표 전화')}
          </label>
          <input
            id="seo-tel"
            type="tel"
            className="admin-form-input"
            value={info.telephone}
            onChange={(e) => onSet('telephone', e.target.value)}
            maxLength={30}
            placeholder="+1-201-555-0123"
            disabled={saving}
          />
          <p className="admin-form-help">
            {t('admin.seo.phoneHelp', '구글 비즈니스 프로필과 동일한 번호·형식으로.')}
          </p>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="seo-email">
            {t('admin.seo.email', '대표 이메일')}
          </label>
          <input
            id="seo-email"
            type="email"
            className="admin-form-input"
            value={info.email}
            onChange={(e) => onSet('email', e.target.value)}
            maxLength={120}
            placeholder="info@ktdoc.org"
            disabled={saving}
          />
        </div>
      </div>
    </section>
  );
}
