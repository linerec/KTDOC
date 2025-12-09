'use client';

/**
 * GalleryHero Component
 * 갤러리 히어로 섹션 - IntlObject 적용
 */

import IntlObject from '@/components/common/IntlObject';

export default function GalleryHero() {
  return (
    <section className="gallery-hero">
      <div className="container">
        <IntlObject keycode="gallery.hero.label" className="gallery-hero-label" />
        <IntlObject keycode="gallery.hero.title" returnType="h1" className="gallery-hero-title" />
        <IntlObject keycode="gallery.hero.subtitle" returnType="p" className="gallery-hero-subtitle" />
        <IntlObject keycode="gallery.hero.description" returnType="p" className="gallery-hero-description" />
      </div>
    </section>
  );
}
