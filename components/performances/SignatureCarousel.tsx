'use client';

/**
 * SignatureCarousel — 대표 공연(Signature Works) 배너
 *
 * 운영진이 "대표 공연"으로 켠 공연이 하나면 정지 배너, 여럿이면 자동으로 넘어가는
 * 슬라이드쇼다(2026-09-10 결정). 어느 공연이 배너에 서는지는 lib/d1/eventViews.ts의
 * signatureWorks 관점이 정하고, 여기는 보여주기만 한다.
 *
 * 움직임의 원칙:
 *  - 배경은 섹션 전체를 덮는 층으로 겹쳐 두고 교차 페이드, 활성 배경만 천천히 확대(켄 번스).
 *  - 글은 슬라이드마다 자기 것을 갖고 같은 칸(grid-area 1/1)에 겹친다 — 가장 긴 제목이
 *    섹션 높이를 정하므로 넘어갈 때 화면이 출렁이지 않는다.
 *  - 마우스를 올리거나 포커스가 안에 있으면 멈춘다. 탭이 숨겨져도 멈춘다.
 *  - 동작 최소화(prefers-reduced-motion)면 자동 넘김과 확대를 끈다. 화살표·점은 남긴다.
 *  - 키보드 ←/→, 터치 스와이프.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import IntlObject from '@/components/common/IntlObject';
import { useLanguage } from '@/contexts/LanguageContext';
import { useT } from '@/lib/i18n/useT';
import type { EventWithCategory } from '@/types/gallery';

interface SignatureCarouselProps {
  events: EventWithCategory[];
  /** 자동 넘김 간격(ms). 시험·미리보기에서 줄일 수 있게 열어 둔다. */
  intervalMs?: number;
}

const SWIPE_PX = 40;

export default function SignatureCarousel({ events, intervalMs = 7000 }: SignatureCarouselProps) {
  const { locale } = useLanguage();
  const t = useT();
  const isKo = locale === 'ko';
  const count = events.length;
  const multi = count > 1;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count]
  );

  // 동작 최소화 선호 — 자동 넘김 없음
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // 탭이 뒤로 가면 멈춘다 — 돌아왔을 때 몇 장을 건너뛴 채 서 있지 않게
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const playing = multi && !paused && !reduced && !hidden;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearInterval(id);
  }, [playing, count, intervalMs, index]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!multi) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null || !multi) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < SWIPE_PX) return;
    go(dx < 0 ? index + 1 : index - 1);
  };

  const anyImage = events.some((ev) => ev.poster_url || ev.thumbnail_url || ev.first_image_url);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section
      className={`performance-hero${anyImage ? '' : ' performance-hero--no-image'}${multi ? ' performance-hero--carousel' : ''}${playing ? '' : ' is-paused'}`}
      style={{ '--hero-interval': `${intervalMs}ms` } as React.CSSProperties}
      aria-roledescription={multi ? (isKo ? '슬라이드쇼' : 'carousel') : undefined}
      aria-label={multi ? t('pages.performances.signature.eyebrow', '대표 공연 · SIGNATURE WORKS') : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {events.map((ev, i) => {
        const img = ev.poster_url || ev.thumbnail_url || ev.first_image_url;
        if (!img) return null;
        return (
          <div
            key={`bg-${ev.id}`}
            className={`performance-hero-bg${i === index ? ' is-active' : ''}`}
            aria-hidden="true"
          >
            <Image
              src={img}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className="performance-hero-img"
            />
          </div>
        );
      })}
      <div className="performance-hero-overlay" aria-hidden="true" />

      <div className="container performance-hero-inner">
        <div className="performance-hero-track">
          {events.map((ev, i) => {
            const active = i === index;
            const title = isKo ? ev.title_ko : ev.title_en || ev.title_ko;
            const category = isKo
              ? ev.category_name_ko
              : ev.category_name_en || ev.category_name_ko;
            return (
              <div
                key={ev.id}
                className={`performance-hero-slide${active ? ' is-active' : ''}`}
                aria-hidden={!active}
                {...(multi
                  ? { role: 'group', 'aria-roledescription': isKo ? '슬라이드' : 'slide', 'aria-label': `${i + 1} / ${count}` }
                  : {})}
              >
                <p className="performance-hero-eyebrow">
                  <IntlObject keycode="pages.performances.signature.eyebrow" />
                </p>
                {active ? (
                  <h1 className="performance-hero-title">{title}</h1>
                ) : (
                  <p className="performance-hero-title">{title}</p>
                )}
                <p className="performance-hero-meta">
                  {ev.year}
                  {category ? ` · ${category}` : ''}
                </p>
                <Link
                  href={`/gallery/${ev.year}/${ev.slug}`}
                  className="btn-ink-primary performance-hero-cta"
                  tabIndex={active ? 0 : -1}
                >
                  <IntlObject keycode="pages.performances.heroCta" />
                </Link>
              </div>
            );
          })}
        </div>

        {multi && (
          <div className="performance-hero-controls">
            <button
              type="button"
              className="performance-hero-arrow"
              onClick={() => go(index - 1)}
              aria-label={t('pages.performances.carousel.prev', '이전 공연')}
            >
              <span aria-hidden="true">←</span>
            </button>
            <ol className="performance-hero-dots" aria-label={t('pages.performances.carousel.dots', '대표 공연 고르기')}>
              {events.map((ev, i) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    className={`performance-hero-dot${i === index ? ' is-active' : ''}`}
                    onClick={() => go(i)}
                    aria-label={isKo ? ev.title_ko : ev.title_en || ev.title_ko}
                    aria-current={i === index ? 'true' : undefined}
                  />
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="performance-hero-arrow"
              onClick={() => go(index + 1)}
              aria-label={t('pages.performances.carousel.next', '다음 공연')}
            >
              <span aria-hidden="true">→</span>
            </button>
            <span className="performance-hero-counter" aria-hidden="true">
              {pad(index + 1)} <em>/</em> {pad(count)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
