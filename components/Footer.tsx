'use client';

/**
 * Footer — 로컬 SEO 기준으로 구성된 사이트 공통 푸터.
 *
 * 구성(로컬 SEO 체크리스트):
 *  - NAP(상호·주소·전화)를 모든 페이지에 일반 텍스트로 노출(<address> + tel:/mailto:)
 *    → 값은 /admin/seo 패널(single source, SiteBusinessContext)에서 온다.
 *  - 내부 링크 5~15개(둘러보기 컬럼) — 키워드 스터핑 없이 페이지 제목 그대로.
 *  - 소개문·컬럼 제목 등 문구는 IntlObject(편집 모드에서 수정 가능).
 */

import Image from 'next/image';
import Link from 'next/link';
import IntlObject from '@/components/common/IntlObject';
import ImageObject from '@/components/common/ImageObject';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSiteBusiness } from '@/contexts/SiteBusinessContext';
import { useSiteTheme } from '@/contexts/SiteThemeContext';
import { headerLogoAsset } from '@/lib/headerBackground';
import {
  BUSINESS_DAYS,
  DEFAULT_SEO_BUSINESS,
  formatAddressLine,
  groupBusinessHours,
  hasFullAddress,
  telHref,
} from '@/lib/seoBusiness';

/** 둘러보기 컬럼 내부 링크 — 라벨은 헤더 내비 문구(locale 키)를 재사용한다. */
const NAV_LINKS: { href: string; keycode: string }[] = [
  { href: '/about', keycode: 'header.about' },
  { href: '/classes', keycode: 'header.classes' },
  { href: '/performances', keycode: 'header.performances' },
  { href: '/gallery', keycode: 'header.gallery' },
  { href: '/media', keycode: 'header.media' },
  { href: '/timeline', keycode: 'header.timeline' },
  { href: '/students', keycode: 'header.students' },
  { href: '/glossary', keycode: 'header.glossary' },
];

export default function Footer() {
  const { locale } = useLanguage();
  const business = useSiteBusiness();
  const { theme } = useSiteTheme();

  const businessName = locale === 'ko' ? business.nameKo : business.nameEn;
  const addressLine = formatAddressLine(business);
  const hourGroups = groupBusinessHours(business.hours);
  const dayLabel = (key: string) => {
    const day = BUSINESS_DAYS.find((d) => d.key === key);
    return day ? (locale === 'ko' ? day.ko : day.en) : key;
  };

  return (
    <footer id="main-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-logo">
            <ImageObject
              keycode="image.footer.logo"
              width={160}
              height={40}
              className="footer-logo-img"
              fallbackSrc={headerLogoAsset(theme === 'light' ? 'default' : 'white').src}
            />
          </div>
          <div className="social-links">
            <Link href={business.instagram || DEFAULT_SEO_BUSINESS.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Image
                src="/assets/images/icon-instagram.png"
                alt="Instagram"
                width={32}
                height={32}
                className="social-icon-color"
              />
            </Link>
            <Link href={business.youtube || 'https://www.youtube.com/@ktdoc1737'} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <Image
                src="/assets/images/youtube-icon.png"
                alt="YouTube"
                width={32}
                height={32}
                className="social-icon-color"
              />
            </Link>
          </div>
        </div>

        <div className="footer-grid">
          {/* 소개: 상호 + 지역 소개문(로컬 키워드는 자연스러운 문장 안에서만) */}
          <div className="footer-col footer-col-about">
            <p className="footer-biz-name">{businessName}</p>
            <IntlObject keycode="footer.tagline" returnType="p" className="footer-tagline" />
            <IntlObject keycode="footer.contact" returnType="p" className="footer-contact" />
          </div>

          {/* 둘러보기: 주요 공개 페이지 내부 링크 */}
          <nav className="footer-col footer-col-nav" aria-label="Footer navigation">
            <IntlObject keycode="footer.nav.title" returnType="p" className="footer-col-title" />
            <ul className="footer-nav-list">
              {NAV_LINKS.map(({ href, keycode }) => (
                <li key={href}>
                  <Link href={href}>
                    <IntlObject keycode={keycode} />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* 연락처(NAP) + 운영시간 — /admin/seo에서 입력한 값이 그대로 노출된다 */}
          <div className="footer-col footer-col-contact">
            <IntlObject keycode="footer.contactTitle" returnType="p" className="footer-col-title" />
            {hasFullAddress(business) && (
              <address className="footer-address">
                {business.googleMaps ? (
                  <a href={business.googleMaps} target="_blank" rel="noopener noreferrer nofollow">
                    {addressLine}
                  </a>
                ) : (
                  addressLine
                )}
              </address>
            )}
            {business.telephone && (
              <p className="footer-contact-line">
                <a href={telHref(business.telephone)}>{business.telephone}</a>
              </p>
            )}
            {business.email && (
              <p className="footer-contact-line">
                <a href={`mailto:${business.email}`}>{business.email}</a>
              </p>
            )}
            {business.kakao && (
              <p className="footer-contact-line">
                <a href={business.kakao} target="_blank" rel="noopener noreferrer">
                  <IntlObject keycode="contact.kakao" />
                </a>
              </p>
            )}
            {hourGroups.length > 0 && (
              <div className="footer-hours">
                <IntlObject keycode="footer.hoursTitle" returnType="p" className="footer-hours-title" />
                <ul className="footer-hours-list">
                  {hourGroups.map((g) => (
                    <li key={g.days.join('-')}>
                      <span className="footer-hours-days">{g.days.map(dayLabel).join(' · ')}</span>
                      <span className="footer-hours-time">{g.opens}–{g.closes}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link href="/calendar" className="footer-cal-link">
              📅 <IntlObject keycode="footer.calendar" />
            </Link>
          </div>
        </div>

        <div className="footer-bottom">
          {/* 저작권 줄은 SEO 패널(/admin/seo)의 상호에서 자동 생성 — 별도 편집 대상이 아니다 */}
          <p>© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
          {/* 법적 고지 — 문안은 lib/legalContent.ts에서 코드로 버전 관리 */}
          <nav className="footer-legal" aria-label="Legal">
            <Link href="/privacy"><IntlObject keycode="footer.privacy" /></Link>
            <span aria-hidden="true">·</span>
            <Link href="/terms"><IntlObject keycode="footer.terms" /></Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
