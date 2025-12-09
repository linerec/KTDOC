'use client';

/**
 * EventCard Component
 * 이벤트 카드 - 썸네일, 날짜, 제목, 설명 미리보기, Read More 버튼 표시
 * 클릭 시 상세 페이지로 이동
 */

import Link from 'next/link';
import Image from 'next/image';
import type { EventWithCategory } from '@/types/gallery';
import { formatEventDateIntl } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';

interface EventCardProps {
  event: EventWithCategory;
  showCategory?: boolean;
}

export default function EventCard({
  event,
  showCategory = true,
}: EventCardProps) {
  const { locale, messages } = useLanguage();
  const title = locale === 'ko' ? event.title_ko : (event.title_en || event.title_ko);
  const description = locale === 'ko'
    ? event.description_ko
    : (event.description_en || event.description_ko);
  const categoryName = locale === 'ko'
    ? event.category_name_ko
    : (event.category_name_en || event.category_name_ko);

  // Intl.DateTimeFormat을 활용한 날짜 포맷팅
  const formattedDate = formatEventDateIntl(event.event_date, locale);

  // Thumbnail priority: thumbnail_url > poster_url > first_image_url
  const imageUrl = event.thumbnail_url || event.poster_url || event.first_image_url;

  return (
    <Link
      href={`/gallery/${event.year}/${event.slug}`}
      className="gallery-event-card"
      aria-label={messages['gallery.card.viewDetails'] || 'View event details'}
    >
      <div className="gallery-event-card-image">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="gallery-event-card-img"
          />
        ) : (
          <div className="gallery-event-card-placeholder">
            <span>{messages['common.noImage'] || 'No Image'}</span>
          </div>
        )}
        {event.is_featured === 1 && (
          <span className="gallery-event-card-featured">
            {messages['common.featured'] || 'Featured'}
          </span>
        )}
      </div>
      <div className="gallery-event-card-content">
        <span className="gallery-event-card-date">{formattedDate}</span>
        <h3 className="gallery-event-card-title">{title}</h3>
        {showCategory && categoryName && (
          <span className="gallery-event-card-category">{categoryName}</span>
        )}
        {/* 설명 미리보기 (2줄) - 클릭 시 상세 페이지로 이동 */}
        {description && (
          <p className="gallery-event-card-description">{description}</p>
        )}
        {/* Read More 버튼 - 상세 페이지 이동 명시 */}
        <span className="gallery-event-card-read-more">
          {messages['gallery.card.readMore'] || 'Read More'}
          <svg
            className="gallery-event-card-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
