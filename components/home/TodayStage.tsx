'use client';

/**
 * TodayStage — 홈 "오늘의 무대"
 *
 * 오늘 열리는 공개 행사가 있을 때만 '최근의 기록' 위에 선다. 지나가는 방문자가
 * 스크롤을 멈추지 않아도 "아, 오늘 이걸 하는구나"까지는 읽고 가게 하는 것이 목적이라,
 * 기록 카드와 달리 사진을 크게 쓰고 시각·장소를 문장이 아닌 한 줄씩 세운다.
 *
 * 문구는 하루 종일 참이어야 한다. 저녁에 들어온 사람에게 "곧 시작합니다"는 거짓이
 * 되므로 시제를 넣지 않는다 — '오늘의 무대'와 시각만 둔다.
 *
 * 제목·설명이 로케일에 따라 갈리므로 클라이언트 컴포넌트다(RecentJourneyCard와 같은 이유).
 */

import Link from 'next/link';
import Image from 'next/image';
import type { EventWithCategory } from '@/types/gallery';
import { formatEventDateIntl, formatEventTimeRange } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';
import { useT } from '@/lib/i18n/useT';

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 1.9" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function StageCard({ event }: { event: EventWithCategory }) {
  const { locale } = useLanguage();
  const t = useT();

  const title = locale === 'ko' ? event.title_ko : event.title_en || event.title_ko;
  const image = event.thumbnail_url || event.poster_url || event.first_image_url;
  // 집합 시각(call_time)은 출연자용이라 넘기지 않는다 — formatEventTimeRange 주석 참고.
  const time = formatEventTimeRange(event.start_time, event.end_time, locale);

  return (
    <Link href={`/gallery/${event.year}/${event.slug}`} className="today-stage-card">
      <div className="today-stage-media">
        {image ? (
          <>
            {/* 같은 그림을 흐리게 깔아 빈 자리를 메운다. 행사 이미지는 가로 사진일
                때도 있고 세로 포스터일 때도 있는데, 잘라 채우면(cover) 포스터는
                날짜·장소가 적힌 아래쪽이 잘려 나간다. 그래서 앞의 그림은 통째로
                보여주고(contain) 남는 자리는 이 흐린 배경이 받는다. */}
            <Image
              src={image}
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 900px) 100vw, 46vw"
              className="today-stage-img-blur"
            />
            <Image
              src={image}
              alt={title}
              fill
              sizes="(max-width: 900px) 100vw, 46vw"
              className="today-stage-img"
            />
          </>
        ) : (
          <div className="today-stage-placeholder" aria-hidden="true">
            <span>춤누리</span>
          </div>
        )}
      </div>

      <div className="today-stage-body">
        <p className="today-stage-date">{formatEventDateIntl(event.event_date, locale)}</p>
        <h3 className="today-stage-name">{title}</h3>

        <dl className="today-stage-facts">
          {time && (
            <div className="today-stage-fact">
              <dt aria-hidden="true">
                <IconClock />
              </dt>
              <dd>{time}</dd>
            </div>
          )}
          {event.location && (
            <div className="today-stage-fact">
              <dt aria-hidden="true">
                <IconPin />
              </dt>
              <dd>{event.location}</dd>
            </div>
          )}
        </dl>

        {/* 링크 안이라 <a>를 겹치지 않는다 — 보이기만 하는 표시다. */}
        <span className="today-stage-cta">
          {t('home.today.cta', '행사 자세히 보기')}
          <span aria-hidden="true"> →</span>
        </span>
      </div>
    </Link>
  );
}

export default function TodayStage({ events }: { events: EventWithCategory[] }) {
  const t = useT();
  if (events.length === 0) return null;

  return (
    <section className="today-stage" aria-labelledby="today-stage-title">
      <div className="container">
        <div className="today-stage-head">
          <span className="today-stage-badge">
            {/* 점 하나로 '지금 이 날'임을 말한다. 동작 최소화 설정에서는 CSS가 멈춘다. */}
            <span className="today-stage-dot" aria-hidden="true" />
            {t('home.today.badge', '오늘')}
          </span>
          <h2 id="today-stage-title" className="today-stage-title">
            {t('home.today.title', '오늘의 무대')}
          </h2>
        </div>

        <div className={`today-stage-list${events.length > 1 ? ' today-stage-list--many' : ''}`}>
          {events.map((event) => (
            <StageCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </section>
  );
}
