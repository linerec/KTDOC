'use client';

/**
 * MediaHero Component
 * 뉴스 & 미디어 히어로 섹션 — gallery-hero 표준 골격(label → h1 → subtitle → description)
 */

import IntlObject from '@/components/common/IntlObject';

export default function MediaHero() {
  return (
    <section className="media-hero">
      <div className="container">
        <IntlObject keycode="pages.media.eyebrow" className="media-hero-label" />
        <IntlObject keycode="pages.media.title" returnType="h1" className="media-hero-title" />
        <IntlObject keycode="pages.media.subtitle" returnType="p" className="media-hero-subtitle" />
        <IntlObject keycode="pages.media.description" returnType="p" className="media-hero-description" />
      </div>
    </section>
  );
}
