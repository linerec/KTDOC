'use client';

/**
 * EventTimeline Component
 * 연혁 타임라인 — 세로줄 + 연도 sticky 헤딩 + 스크롤 진행 빔.
 *
 * Aceternity Timeline의 기법(sticky 연도, 스크롤에 따라 차오르는 빔)을
 * 이 프로젝트 스택에 맞게 재해석: framer-motion의 useScroll/useTransform 대신
 * rAF 스크롤 핸들러가 CSS 변수(--timeline-progress)를 갱신하고,
 * 빔은 transform: scaleY만 애니메이트한다(컴포지터 전용).
 * Tailwind 클래스는 globals.css의 .timeline-* Plain CSS로 대체.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { EventWithCategory } from '@/types/gallery';
import { formatEventDateIntl } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';
import ScrollReveal from '@/components/common/ScrollReveal';

interface EventTimelineProps {
  events: EventWithCategory[];
}

function formatEventCount(count: number, locale: 'ko' | 'en'): string {
  const formatted = new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US').format(count);
  if (locale === 'ko') return `${formatted}개의 행사`;
  return new Intl.PluralRules('en-US').select(count) === 'one'
    ? `${formatted} event`
    : `${formatted} events`;
}

function TimelineEventCard({ event, index }: { event: EventWithCategory; index: number }) {
  const { locale, messages } = useLanguage();
  const title = locale === 'ko' ? event.title_ko : event.title_en || event.title_ko;
  const description =
    locale === 'ko' ? event.description_ko : event.description_en || event.description_ko;
  const categoryName =
    locale === 'ko' ? event.category_name_ko : event.category_name_en || event.category_name_ko;
  const imageUrl = event.thumbnail_url || event.poster_url || event.first_image_url;

  return (
    <Link
      href={`/gallery/${event.year}/${event.slug}`}
      className="timeline-event-card reveal reveal--up"
      style={{ '--reveal-delay': `${Math.min(index, 5) * 70}ms` } as React.CSSProperties}
    >
      {imageUrl && (
        <div className="timeline-event-card-image">
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 360px"
            className="timeline-event-card-img"
          />
        </div>
      )}
      <div className="timeline-event-card-body">
        <div className="timeline-event-card-meta">
          <span className="timeline-event-card-date">
            {formatEventDateIntl(event.event_date, locale)}
          </span>
          {categoryName && (
            <span className="timeline-event-card-category">{categoryName}</span>
          )}
        </div>
        <h3 className="timeline-event-card-title">{title}</h3>
        {event.location && (
          <span className="timeline-event-card-location">{event.location}</span>
        )}
        {description && <p className="timeline-event-card-description">{description}</p>}
        <span className="timeline-event-card-more">
          {messages['gallery.card.readMore'] || '자세히 보기'} →
        </span>
      </div>
    </Link>
  );
}

export default function EventTimeline({ events }: EventTimelineProps) {
  const { locale, messages } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);

  // 정렬 방향: desc = 현재→과거(기본), asc = 과거→현재
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 선택 방향으로 연도·연도 내 날짜를 함께 정렬한다
  const yearGroups = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    const map = new Map<number, EventWithCategory[]>();
    for (const event of events) {
      const list = map.get(event.year) || [];
      list.push(event);
      map.set(event.year, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] - b[0]) * dir)
      .map(
        ([year, list]) =>
          [year, [...list].sort((a, b) => a.event_date.localeCompare(b.event_date) * dir)] as const
      );
  }, [events, sortOrder]);

  // 스크롤 진행 빔: 빔 선단(뷰포트 60% 지점)이 트랙을 통과한 비율을 CSS 변수로
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--timeline-progress', '1');
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      if (rect.height <= 0) return;
      const lead = window.innerHeight * 0.6;
      const progress = Math.min(1, Math.max(0, (lead - rect.top) / rect.height));
      el.style.setProperty('--timeline-progress', progress.toFixed(4));
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
    };
  }, []);

  if (events.length === 0) {
    return (
      <p className="timeline-empty">
        {messages['pages.timeline.empty'] || '아직 등록된 기록이 없습니다.'}
      </p>
    );
  }

  const sortAscLabel = messages['pages.timeline.sort.asc'] || '과거 → 현재';
  const sortDescLabel = messages['pages.timeline.sort.desc'] || '현재 → 과거';

  return (
    <>
      <div className="timeline-controls">
        <div
          className="timeline-sort"
          role="group"
          aria-label={messages['pages.timeline.sort.label'] || '정렬 순서'}
        >
          <button
            type="button"
            className={`timeline-sort-btn${sortOrder === 'asc' ? ' is-active' : ''}`}
            onClick={() => setSortOrder('asc')}
            aria-pressed={sortOrder === 'asc'}
          >
            {sortAscLabel}
          </button>
          <button
            type="button"
            className={`timeline-sort-btn${sortOrder === 'desc' ? ' is-active' : ''}`}
            onClick={() => setSortOrder('desc')}
            aria-pressed={sortOrder === 'desc'}
          >
            {sortDescLabel}
          </button>
        </div>
      </div>

      <div className="timeline-track" ref={trackRef}>
        <ScrollReveal />
        <div className="timeline-line" aria-hidden="true">
          <div className="timeline-beam" />
        </div>

      {yearGroups.map(([year, list]) => (
        <section className="timeline-entry" key={year} id={`timeline-${year}`}>
          {/* 데스크톱: 노드 + 연도 sticky. 모바일: 노드만 남고 연도는 본문 위로 */}
          <div className="timeline-entry-side">
            <div className="timeline-node">
              <span />
            </div>
            <div className="timeline-year-wrap">
              <h2 className="timeline-year">{year}</h2>
              <span className="timeline-year-count">
                {formatEventCount(list.length, locale)}
              </span>
            </div>
          </div>

          <div className="timeline-entry-body">
            <div className="timeline-entry-heading">
              <h2 className="timeline-year">{year}</h2>
              <span className="timeline-year-count">
                {formatEventCount(list.length, locale)}
              </span>
            </div>
            <div className="timeline-events">
              {list.map((event, i) => (
                <TimelineEventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </div>
        </section>
      ))}
      </div>
    </>
  );
}
