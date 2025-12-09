'use client';

/**
 * YearSection Component
 * 연도별 섹션 - 연도 헤더와 이벤트 그리드
 * Intl 객체를 활용한 국제화 지원
 */

import type { EventWithCategory } from '@/types/gallery';
import EventCard from './EventCard';
import { useLanguage } from '@/contexts/LanguageContext';

interface YearSectionProps {
  year: number;
  events: EventWithCategory[];
  showCategory?: boolean;
}

/**
 * Intl.PluralRules를 활용한 이벤트 개수 포맷팅
 * 영어: 단수/복수 자동 처리, 한국어: 숫자 포맷팅
 */
function formatEventCount(count: number, locale: 'ko' | 'en'): string {
  const numberFormatter = new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US');
  const formattedCount = numberFormatter.format(count);

  if (locale === 'ko') {
    return `${formattedCount}개의 행사`;
  }

  // Intl.PluralRules를 사용한 영어 단수/복수 처리
  const pluralRules = new Intl.PluralRules('en-US');
  const pluralForm = pluralRules.select(count);

  return pluralForm === 'one'
    ? `${formattedCount} event`
    : `${formattedCount} events`;
}

export default function YearSection({
  year,
  events,
  showCategory = true,
}: YearSectionProps) {
  const { locale } = useLanguage();

  if (events.length === 0) return null;

  // Intl을 활용한 이벤트 카운트 텍스트
  const eventCountText = formatEventCount(events.length, locale);

  return (
    <section className="gallery-year-section" id={`year-${year}`}>
      <div className="gallery-year-header">
        <h2 className="gallery-year-title">{year}</h2>
        <span className="gallery-year-count">{eventCountText}</span>
      </div>
      <div className="gallery-events-grid">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            showCategory={showCategory}
          />
        ))}
      </div>
    </section>
  );
}
