'use client';

/**
 * PerformancesHero Component
 * 공연 페이지 표준 히어로 — gallery-hero 골격(label → h1 → subtitle → description).
 * 대표 공연 시네마틱 배너(PerformanceHero)는 이 아래에 섹션으로 이어진다.
 */

import IntlObject from '@/components/common/IntlObject';

export default function PerformancesHero() {
  return (
    <section className="performances-hero">
      <div className="container">
        <IntlObject keycode="pages.performances.eyebrow" className="performances-hero-label" />
        <IntlObject keycode="pages.performances.title" returnType="h1" className="performances-hero-title" />
        <IntlObject keycode="pages.performances.subtitle" returnType="p" className="performances-hero-subtitle" />
        <IntlObject keycode="pages.performances.description" returnType="p" className="performances-hero-description" />
      </div>
    </section>
  );
}
