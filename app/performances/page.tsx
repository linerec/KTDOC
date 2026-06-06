/**
 * Performances Page
 * 공연 시네마틱 쇼케이스 — 대표 공연(is_signature) 큐레이션. 정식 상세/연도 기록은 /gallery.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
import PerformanceHero from '@/components/performances/PerformanceHero';
import RepertoireSection from '@/components/performances/RepertoireSection';
import ArchiveBridge from '@/components/performances/ArchiveBridge';
import { getEvents } from '@/lib/d1';
import type { EventWithCategory } from '@/types/gallery';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '공연 | KTDOC',
  description:
    '춤누리 한국전통무용단의 대표 공연. 전통무용, 타악, K-Drum Ensemble로 구성된 무대를 소개합니다.',
  alternates: { canonical: '/performances' },
  openGraph: {
    title: '공연 | KTDOC',
    description: '춤누리 한국전통무용단의 대표 공연 쇼케이스',
    url: '/performances',
  },
};

interface CategoryGroup {
  slug: string;
  categoryKo: string;
  categoryEn: string;
  events: EventWithCategory[];
}

function groupByCategory(events: EventWithCategory[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const event of events) {
    const slug = event.category_slug || 'other';
    const existing = groups.get(slug);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(slug, {
        slug,
        categoryKo: event.category_name_ko || '기타',
        categoryEn: event.category_name_en || 'Other',
        events: [event],
      });
    }
  }
  return Array.from(groups.values());
}

export default async function PerformancesPage() {
  // 큐레이션된 대표 공연 우선, 없으면 최근 공개 공연으로 폴백
  const showcase = await getEvents({ showcase: true, published: true, limit: 50 });
  let events = showcase.events;
  if (events.length === 0) {
    const fallback = await getEvents({ published: true, limit: 12 });
    events = fallback.events;
  }

  const heroEvent = events[0] || null;
  const restGroups = groupByCategory(events.slice(1));

  return (
    <>
      <Header />
      <main className="performances-page">
        {heroEvent ? (
          <PerformanceHero event={heroEvent} />
        ) : (
          <section className="performance-hero performance-hero--empty">
            <div className="performance-hero-overlay" aria-hidden="true" />
            <div className="container performance-hero-inner">
              <p className="performance-hero-eyebrow">
                <IntlObject keycode="pages.performances.signature.eyebrow" />
              </p>
              <IntlObject keycode="pages.performances.title" returnType="h1" className="performance-hero-title" />
              <IntlObject
                keycode="pages.performances.description"
                returnType="p"
                className="performance-hero-meta"
              />
              <Link href="/gallery" className="btn-ink-ghost performance-hero-cta">
                <IntlObject keycode="pages.performances.viewArchiveCta" />
              </Link>
            </div>
          </section>
        )}

        {restGroups.length > 0 && (
          <section className="performances-main">
            <div className="container">
              {restGroups.map((group) => (
                <RepertoireSection
                  key={group.slug}
                  categoryKo={group.categoryKo}
                  categoryEn={group.categoryEn}
                  events={group.events}
                />
              ))}
            </div>
          </section>
        )}

        {heroEvent && <ArchiveBridge />}
      </main>
      <Footer />
    </>
  );
}
