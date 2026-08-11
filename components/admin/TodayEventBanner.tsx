'use client';

/**
 * TodayEventBanner — 콘솔 홈(/admin)의 '오늘의 일정'
 *
 * 홈 화면 아이콘(PWA)으로 앱을 열면 여기가 첫 화면이다. 그래서 오늘 행사가 있으면
 * 스크롤하기 전에 보여야 한다 — 인사말 바로 아래, 다른 어떤 카드보다 먼저.
 *
 * 공개 사이트의 TodayStage와 형제지만 컴포넌트를 나눴다. 둘은 지면이 다르다:
 * 공개 사이트는 한지/먹 지면 토큰(--ground-*)을, 콘솔은 콘솔 토큰(--surface-2 등)을
 * 쓴다. 한 컴포넌트로 두 토큰 체계를 태우면 한쪽 테마에서 조용히 대비가 무너진다.
 * 공유하는 것은 데이터(EventWithCategory)와 길찾기 링크(lib/maps/directions)다.
 *
 * 여러 건이면 모두 보여준다 — 하루에 두 개면 둘 다 챙겨야 하는 날이다.
 */

import Link from 'next/link';
import type { EventWithCategory } from '@/types/gallery';
import { formatEventDateIntl, formatEventTimeRange } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';
import { useT } from '@/lib/i18n/useT';
import { directionsHref } from '@/lib/maps/directions';

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 1.9" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}
function IconRoute() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 17h6a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h6" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="5.5" cy="18.5" r="1.8" />
    </svg>
  );
}

function EventRow({ event }: { event: EventWithCategory }) {
  const { locale } = useLanguage();
  const t = useT();

  const title = locale === 'ko' ? event.title_ko : event.title_en || event.title_ko;
  // 집합 시각(call_time)은 출연자용 내부 정보라 넣지 않는다 — types/gallery 주석 참고.
  const time = formatEventTimeRange(event.start_time, event.end_time, locale);
  const mapHref = directionsHref({
    location: event.location,
    address: event.location_address,
    lat: event.location_lat,
    lng: event.location_lng,
    locationUrl: event.location_url,
  });

  return (
    <div className="today-banner-item">
      <h3 className="today-banner-name">{title}</h3>

      <dl className="today-banner-facts">
        {time && (
          <div className="today-banner-fact">
            <dt aria-hidden="true">
              <IconClock />
            </dt>
            <dd>{time}</dd>
          </div>
        )}
        {event.location && (
          <div className="today-banner-fact">
            <dt aria-hidden="true">
              <IconPin />
            </dt>
            <dd>{event.location}</dd>
          </div>
        )}
      </dl>

      <div className="today-banner-actions">
        {mapHref && (
          <a
            className="admin-btn admin-btn-gold today-banner-map"
            href={mapHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconRoute />
            {t('admin.home.todayDirections', '오는 길')}
          </a>
        )}
        <Link href={`/admin/library/${event.id}`} className="admin-btn admin-btn-outline">
          {t('admin.home.todayDetail', '행사 정보 보기')}
        </Link>
      </div>
    </div>
  );
}

export default function TodayEventBanner({ events }: { events: EventWithCategory[] }) {
  const { locale } = useLanguage();
  const t = useT();
  if (events.length === 0) return null;

  return (
    <section className="today-banner" aria-labelledby="today-banner-title">
      <div className="today-banner-head">
        <span className="today-banner-badge">
          <span className="today-banner-dot" aria-hidden="true" />
          {t('admin.home.todayBadge', '오늘')}
        </span>
        <h2 id="today-banner-title" className="today-banner-title">
          {t('admin.home.todayTitle', '오늘의 일정')}
        </h2>
        <span className="today-banner-date">
          {formatEventDateIntl(events[0].event_date, locale)}
        </span>
      </div>

      <div className="today-banner-list">
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}
