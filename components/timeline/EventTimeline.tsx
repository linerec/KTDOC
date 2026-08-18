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
import type { EventWithCategory, EventKind } from '@/types/gallery';
import { formatEventDateIntl, formatEventDateMonthDay } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';
import ScrollReveal from '@/components/common/ScrollReveal';

interface EventTimelineProps {
  events: EventWithCategory[];
  /**
   * 이 연도 미만의 그룹은 카드 대신 압축 행으로 그린다.
   * 오래된 기록은 이미지가 거의 없어 카드 이미지 슬롯이 전부 플레이스홀더로
   * 반복되고 스크롤만 길어진다 — 최근만 카드, 과거는 밀도로 보여준다.
   * 서버(page.tsx)가 계산해 내려준다(하이드레이션 불일치 방지).
   */
  compactBeforeYear?: number;
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
      {/* 이미지 슬롯은 사진이 없어도 자리를 지킨다 — 비우면 아래 텍스트가 위로
          올라와 같은 줄의 카드들과 시작선이 어긋난다(.card-placeholder 참고) */}
      <div className="timeline-event-card-image">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 360px"
            className="timeline-event-card-img"
          />
        ) : (
          <div className="timeline-event-card-placeholder" aria-hidden="true">
            <span>춤누리</span>
          </div>
        )}
      </div>
      <div className="timeline-event-card-body">
        <div className="timeline-event-card-meta">
          <span className="timeline-event-card-date">
            {formatEventDateIntl(event.event_date, locale)}
          </span>
          {/* 학내 행사만 표시한다 — 대다수인 공연에까지 붙이면 소음이 된다 */}
          {event.kind === 'school' && (
            <span className="timeline-event-card-kind">
              {messages['timeline.kind.school'] || '학내 행사'}
            </span>
          )}
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

/** 압축 행 — 오래된 연도용. 날짜·제목·칩 한 줄, 목적지는 카드와 동일한 상세 페이지 */
function TimelineCompactRow({ event, index }: { event: EventWithCategory; index: number }) {
  const { locale, messages } = useLanguage();
  const title = locale === 'ko' ? event.title_ko : event.title_en || event.title_ko;
  const categoryName =
    locale === 'ko' ? event.category_name_ko : event.category_name_en || event.category_name_ko;

  // 연도만 아는 오래된 기록은 1월 1일로 저장돼 있다(2022년 이전 게시분 전부가 01-01).
  // 가짜 날짜를 49번 반복하는 건 소음이므로 실제 날짜가 있을 때만 표시한다.
  const hasRealDate = event.event_date.slice(5, 10) !== '01-01';

  return (
    <Link
      href={`/gallery/${event.year}/${event.slug}`}
      className="timeline-compact-row reveal reveal--up"
      style={{ '--reveal-delay': `${Math.min(index, 5) * 40}ms` } as React.CSSProperties}
    >
      {hasRealDate && (
        <span className="timeline-compact-date">
          {formatEventDateMonthDay(event.event_date, locale)}
        </span>
      )}
      <span className="timeline-compact-title">{title}</span>
      {/* 카드와 같은 규칙: 학내 행사만 표시, 공연에는 붙이지 않는다 */}
      {event.kind === 'school' && (
        <span className="timeline-event-card-kind">
          {messages['timeline.kind.school'] || '학내 행사'}
        </span>
      )}
      {categoryName && <span className="timeline-event-card-category">{categoryName}</span>}
    </Link>
  );
}

export default function EventTimeline({ events, compactBeforeYear }: EventTimelineProps) {
  const { locale, messages } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);

  // 정렬 방향: desc = 현재→과거(기본), asc = 과거→현재
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 종류 필터: all = 전체(기본), performance = 공연, school = 학내 행사
  const [kindFilter, setKindFilter] = useState<'all' | EventKind>('all');

  const visibleEvents = useMemo(
    () => (kindFilter === 'all' ? events : events.filter((e) => e.kind === kindFilter)),
    [events, kindFilter]
  );

  // 선택 방향으로 연도·연도 내 날짜를 함께 정렬한다
  const yearGroups = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    const map = new Map<number, EventWithCategory[]>();
    for (const event of visibleEvents) {
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
  }, [visibleEvents, sortOrder]);

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

        <div
          className="timeline-sort timeline-kind-filter"
          role="group"
          aria-label={messages['timeline.kind.label'] || '종류'}
        >
          {(['all', 'performance', 'school'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`timeline-sort-btn${kindFilter === k ? ' is-active' : ''}`}
              onClick={() => setKindFilter(k)}
              aria-pressed={kindFilter === k}
            >
              {k === 'all'
                ? messages['timeline.kind.all'] || '전체'
                : k === 'performance'
                  ? messages['timeline.kind.performance'] || '공연'
                  : messages['timeline.kind.school'] || '학내 행사'}
            </button>
          ))}
        </div>
      </div>

      {/* 필터로 결과가 0건이 된 경우 — 컨트롤은 남겨 되돌릴 수 있게 한다 */}
      {yearGroups.length === 0 && (
        <p className="timeline-empty">
          {messages['pages.timeline.empty'] || '아직 등록된 기록이 없습니다.'}
        </p>
      )}

      <div className="timeline-track" ref={trackRef}>
        {/* key 재마운트로 관찰 목록을 갱신한다 — 필터를 바꾸면 걸러졌던 이벤트가
            새 DOM 노드로 재생성되는데, 최초 마운트 때 만든 관찰자는 그 노드를 모르므로
            is-revealed를 영영 못 받아 opacity 0으로 남는다(실측: 필터 순회 후 복귀 시). */}
        <ScrollReveal key={`${kindFilter}-${sortOrder}`} />
        <div className="timeline-line" aria-hidden="true">
          <div className="timeline-beam" />
        </div>

      {yearGroups.map(([year, list]) => {
        // 연도 단위로 끊는다 — 같은 연도 안에서 카드·압축 행이 섞이면 더 난잡하다
        const isCompact = compactBeforeYear !== undefined && year < compactBeforeYear;
        return (
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
            {isCompact ? (
              <div className="timeline-compact-list">
                {list.map((event, i) => (
                  <TimelineCompactRow key={event.id} event={event} index={i} />
                ))}
              </div>
            ) : (
              <div className="timeline-events">
                {list.map((event, i) => (
                  <TimelineEventCard key={event.id} event={event} index={i} />
                ))}
              </div>
            )}
          </div>
        </section>
        );
      })}
      </div>
    </>
  );
}
