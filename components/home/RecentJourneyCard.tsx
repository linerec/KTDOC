'use client';

/**
 * RecentJourneyCard — 홈 "최근 발자취"의 개별 카드.
 *
 * 로케일에 따라 제목·날짜·종류 라벨이 바뀌므로 클라이언트 컴포넌트다.
 * 타임라인과 달리 공연·학내 행사 양쪽 모두에 종류 라벨을 붙인다 —
 * 홈에서는 둘이 섞여 있어 구분 자체가 정보가 된다.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { EventWithCategory } from '@/types/gallery';
import { formatEventDateIntl } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RecentJourneyCard({
  event,
  index,
}: {
  event: EventWithCategory;
  index: number;
}) {
  const { locale, messages } = useLanguage();
  const title = locale === 'ko' ? event.title_ko : event.title_en || event.title_ko;
  const imageUrl = event.thumbnail_url || event.poster_url || event.first_image_url;
  const kindLabel =
    event.kind === 'school'
      ? messages['timeline.kind.school'] || '학내 행사'
      : messages['timeline.kind.performance'] || '공연';

  return (
    <Link
      href={`/gallery/${event.year}/${event.slug}`}
      className="journey-card reveal reveal--up"
      style={{ '--reveal-delay': `${index * 80}ms` } as React.CSSProperties}
    >
      <div className="journey-card-image">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 900px) 100vw, 33vw"
            className="journey-card-img"
          />
        ) : (
          <div className="journey-card-placeholder" aria-hidden="true">
            <span>춤누리</span>
          </div>
        )}
      </div>
      <div className="journey-card-body">
        <div className="journey-card-meta">
          <span className="journey-card-date">
            {formatEventDateIntl(event.event_date, locale)}
          </span>
          <span className="journey-card-kind">{kindLabel}</span>
        </div>
        <h3 className="journey-card-title">{title}</h3>
      </div>
    </Link>
  );
}
