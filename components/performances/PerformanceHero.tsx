'use client';

/**
 * PerformanceHero
 * 공연 페이지 시네마틱 대표 공연 히어로. 정식 상세는 갤러리로 연결.
 */

import Link from 'next/link';
import Image from 'next/image';
import IntlObject from '@/components/common/IntlObject';
import { useLanguage } from '@/contexts/LanguageContext';
import type { EventWithCategory } from '@/types/gallery';

interface PerformanceHeroProps {
  event: EventWithCategory;
}

export default function PerformanceHero({ event }: PerformanceHeroProps) {
  const { locale } = useLanguage();
  const isKo = locale === 'ko';
  const title = isKo ? event.title_ko : event.title_en || event.title_ko;
  const category = isKo
    ? event.category_name_ko
    : event.category_name_en || event.category_name_ko;
  const img = event.poster_url || event.thumbnail_url || event.first_image_url;

  return (
    <section className="performance-hero">
      {img && (
        <div className="performance-hero-bg" aria-hidden="true">
          <Image src={img} alt="" fill priority sizes="100vw" className="performance-hero-img" />
        </div>
      )}
      <div className="performance-hero-overlay" aria-hidden="true" />
      <div className="container performance-hero-inner">
        <p className="performance-hero-eyebrow">
          <IntlObject keycode="pages.performances.signature.eyebrow" />
        </p>
        <h1 className="performance-hero-title">{title}</h1>
        <p className="performance-hero-meta">
          {event.year}
          {category ? ` · ${category}` : ''}
        </p>
        <Link href={`/gallery/${event.year}/${event.slug}`} className="btn-ink-primary performance-hero-cta">
          <IntlObject keycode="pages.performances.heroCta" />
        </Link>
      </div>
    </section>
  );
}
