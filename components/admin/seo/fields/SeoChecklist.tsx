'use client';

/**
 * 지역 검색(로컬 SEO) 체크리스트 — 입력 전에 읽어야 할 규칙
 *
 * 특히 NAP 일관성이 핵심이다. 여기 적은 값이 구글 비즈니스 프로필과 글자 하나라도
 * 다르면 검색엔진이 다른 업체로 볼 수 있다.
 */

import { useT } from '@/lib/i18n/useT';
import T from '@/components/common/T';

export default function SeoChecklist() {
  const t = useT();

  return (
    <section className="admin-form-section admin-account-card">
      <h2 className="admin-form-section-title">
        {t('admin.seo.checklistTitle', '지역 검색(로컬 SEO) 체크리스트')}
      </h2>
      <ul className="admin-seo-checklist">
        <li>
          <T k="admin.seo.checkNap" params={{ label: <strong>{t('admin.seo.checkNapLabel', 'NAP 일관성')}</strong> }}>
            {'{label} — 상호(Name)·주소(Address)·전화(Phone)는 구글 비즈니스 프로필, 이 사이트, 다른 디렉터리(Yelp 등)에서 글자 단위로 동일해야 합니다. “Suite 200”과 “Ste 200”처럼 표기가 갈리면 안 됩니다.'}
          </T>
        </li>
        <li>
          <T k="admin.seo.checkAddress" params={{ label: <strong>{t('admin.seo.checkAddressLabel', '주소·전화 필수')}</strong> }}>
            {'{label} — 주소 4개 항목이 채워지면 검색엔진에 LocalBusiness(지역 업체)로 게시되고, 비어 있는 동안은 Organization 수준으로만 게시됩니다.'}
          </T>
        </li>
        <li>
          <T
            k="admin.seo.checkPhone"
            params={{
              label: <strong>{t('admin.seo.checkPhoneLabel', '전화 형식')}</strong>,
              example: <code>+1-201-555-0123</code>,
            }}
          >
            {'{label} — 국가·지역번호 포함 {example} 형식을 권장합니다.'}
          </T>
        </li>
        <li>
          <T k="admin.seo.checkHours" params={{ label: <strong>{t('admin.seo.checkHoursLabel', '운영시간·좌표')}</strong> }}>
            {'{label} — 구글 권장 항목입니다. 채울수록 검색 노출 품질이 올라갑니다.'}
          </T>
        </li>
      </ul>
    </section>
  );
}
