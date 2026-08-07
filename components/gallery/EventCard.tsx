'use client';

/**
 * EventCard Component
 * 이벤트 카드 - 썸네일, 날짜, 제목, 설명 미리보기, Read More 버튼 표시
 * 클릭 시 상세 페이지로 이동
 */

import Link from 'next/link';
import Image from 'next/image';
import type { EventWithCategory } from '@/types/gallery';
import { formatEventDateIntl, formatEventTimeRange } from '@/types/gallery';
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
  // 시작 시각만 쓴다. 카드는 훑는 자리라 "언제 시작하나"까지가 필요한 전부이고,
  // 종료까지 붙이면 한 줄이 길어져 제목과 경쟁한다. 집합 시각은 출연자용이라
  // 공개 화면에 넣지 않는다(formatEventTimeRange 주석).
  const formattedTime = formatEventTimeRange(event.start_time, null, locale);

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
        <span className="gallery-event-card-date">
          {formattedDate}
          {formattedTime && <span className="gallery-event-card-time">{formattedTime}</span>}
        </span>
        <h3 className="gallery-event-card-title">{title}</h3>
        {/* 장소 — 목록에서 "언제·어디서"가 함께 읽혀야 한다. 예전에는 날짜만 있어
            어디서 하는지 알려면 상세로 들어가야 했다. 주소가 아니라 장소명만 둔다. */}
        {event.location && (
          <span className="gallery-event-card-venue">{event.location}</span>
        )}
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
