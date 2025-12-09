'use client';

/**
 * GalleryAdjacentNav Component
 * 이전/다음 이벤트 네비게이션
 */

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import type { EventWithCategory } from '@/types/gallery';

interface GalleryAdjacentNavProps {
  prev: EventWithCategory | null;
  next: EventWithCategory | null;
}

export default function GalleryAdjacentNav({ prev, next }: GalleryAdjacentNavProps) {
  const { locale, messages } = useLanguage();

  const prevLabel = messages['gallery.detail.previous'] || 'Previous';
  const nextLabel = messages['gallery.detail.next'] || 'Next';

  return (
    <section className="gallery-detail-adjacent">
      <div className="container">
        <div className="gallery-adjacent-nav">
          {prev ? (
            <Link
              href={`/gallery/${prev.year}/${prev.slug}`}
              className="gallery-adjacent-link gallery-adjacent-prev"
            >
              <span className="gallery-adjacent-label">{prevLabel}</span>
              <span className="gallery-adjacent-title">
                {locale === 'ko' ? prev.title_ko : (prev.title_en || prev.title_ko)}
              </span>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/gallery/${next.year}/${next.slug}`}
              className="gallery-adjacent-link gallery-adjacent-next"
            >
              <span className="gallery-adjacent-label">{nextLabel}</span>
              <span className="gallery-adjacent-title">
                {locale === 'ko' ? next.title_ko : (next.title_en || next.title_ko)}
              </span>
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>
    </section>
  );
}
