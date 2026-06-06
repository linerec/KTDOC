'use client';

/**
 * PerformanceCard
 * 공연 쇼케이스 카드 — 이미지 오버레이 스타일. 정식 상세는 갤러리 아카이브로 연결.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { EventWithCategory } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';

interface PerformanceCardProps {
  event: EventWithCategory;
}

export default function PerformanceCard({ event }: PerformanceCardProps) {
  const { locale } = useLanguage();
  const isKo = locale === 'ko';
  const title = isKo ? event.title_ko : event.title_en || event.title_ko;
  const category = isKo
    ? event.category_name_ko
    : event.category_name_en || event.category_name_ko;
  const img = event.thumbnail_url || event.poster_url || event.first_image_url;

  return (
    <Link href={`/gallery/${event.year}/${event.slug}`} className="performance-card" aria-label={title}>
      <div className="performance-card-media">
        {img ? (
          <Image
            src={img}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="performance-card-img"
          />
        ) : (
          <div className="performance-card-placeholder" aria-hidden="true">
            <span>춤누리</span>
          </div>
        )}
        <div className="performance-card-scrim" aria-hidden="true" />
        <div className="performance-card-caption">
          <span className="performance-card-meta">
            {event.year}
            {category ? ` · ${category}` : ''}
          </span>
          <h3 className="performance-card-title">{title}</h3>
        </div>
      </div>
    </Link>
  );
}
