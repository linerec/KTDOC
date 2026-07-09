'use client';

/**
 * 법적 고지 문서 렌더러 — /privacy · /terms 공용.
 * 문안은 lib/legalContent.ts(코드 버전 관리)에서 오고, 언어는 사이트
 * 언어 설정(LanguageContext)을 따른다. 문의처는 SEO 패널 연락처(단일 소스)를
 * 그대로 노출한다.
 */

import { useLanguage } from '@/contexts/LanguageContext';
import { useSiteBusiness } from '@/contexts/SiteBusinessContext';
import { formatAddressLine, hasFullAddress, telHref } from '@/lib/seoBusiness';
import { LEGAL_DOCS, type LegalDocKey } from '@/lib/legalContent';

interface LegalDocumentProps {
  doc: LegalDocKey;
}

export default function LegalDocument({ doc }: LegalDocumentProps) {
  const { locale } = useLanguage();
  const business = useSiteBusiness();
  const content = LEGAL_DOCS[doc][locale === 'en' ? 'en' : 'ko'];
  const businessName = locale === 'en' ? business.nameEn : business.nameKo;

  return (
    <>
      <section className="legal-hero">
        <div className="container legal-hero-inner">
          <p className="legal-hero-eyebrow">KTDOC</p>
          <h1 className="legal-hero-title">{content.title}</h1>
          <p className="legal-hero-desc">{content.intro}</p>
        </div>
      </section>

      <section className="legal-body-section">
        <div className="container">
          <article className="legal-body">
            {content.sections.map((section) => (
              <section key={section.heading} className="legal-section">
                <h2>{section.heading}</h2>
                {section.blocks.map((block, i) =>
                  block.list ? (
                    <ul key={i}>
                      {block.list.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i}>{block.p}</p>
                  )
                )}
              </section>
            ))}

            {/* 문의처 — SEO 패널(/admin/seo) 연락처를 단일 소스로 노출 */}
            <div className="legal-contact">
              {businessName && <p className="legal-contact-name">{businessName}</p>}
              {hasFullAddress(business) && <p>{formatAddressLine(business)}</p>}
              {business.telephone && (
                <p>
                  <a href={telHref(business.telephone)}>{business.telephone}</a>
                </p>
              )}
              {business.email && (
                <p>
                  <a href={`mailto:${business.email}`}>{business.email}</a>
                </p>
              )}
            </div>

            <p className="legal-effective">{content.effective}</p>
          </article>
        </div>
      </section>
    </>
  );
}
