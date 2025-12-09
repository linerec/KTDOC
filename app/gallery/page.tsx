/**
 * Gallery Page
 * 공연 아카이브 목록 페이지
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getEvents, getCategories } from '@/lib/d1';
import GalleryHero from '@/components/gallery/GalleryHero';
import GalleryFilter from '@/components/gallery/GalleryFilter';
import YearSection from '@/components/gallery/YearSection';
import GalleryEmptyState from '@/components/gallery/GalleryEmptyState';
import type { EventWithCategory } from '@/types/gallery';

export const metadata: Metadata = {
  title: 'Gallery | KTDOC',
  description: 'Performances Through the Years - Korean Traditional Dance of Choomnoori archive',
};

interface PageProps {
  searchParams: Promise<{
    year?: string;
    category?: string;
    search?: string;
    page?: string;
  }>;
}

// Group events by year
function groupEventsByYear(events: EventWithCategory[]): Map<number, EventWithCategory[]> {
  const grouped = new Map<number, EventWithCategory[]>();

  for (const event of events) {
    const yearEvents = grouped.get(event.year) || [];
    yearEvents.push(event);
    grouped.set(event.year, yearEvents);
  }

  return grouped;
}

async function GalleryContent({
  year,
  category,
  search,
  page,
}: {
  year?: string;
  category?: string;
  search?: string;
  page?: string;
}) {
  const [eventsResult, categories] = await Promise.all([
    getEvents({
      year: year ? parseInt(year) : undefined,
      category: category || undefined,
      search: search || undefined,
      page: page ? parseInt(page) : 1,
      limit: 100, // Get more events for year grouping
      published: true,
    }),
    getCategories(),
  ]);

  const { events, years } = eventsResult;
  const groupedEvents = groupEventsByYear(events);
  const sortedYears = Array.from(groupedEvents.keys()).sort((a, b) => b - a);

  return (
    <>
      <GalleryFilter years={years} categories={categories} />

      {events.length === 0 ? (
        <GalleryEmptyState />
      ) : (
        <div className="gallery-content">
          {sortedYears.map((yearNum) => (
            <YearSection
              key={yearNum}
              year={yearNum}
              events={groupedEvents.get(yearNum) || []}
            />
          ))}
        </div>
      )}
    </>
  );
}

function GalleryLoading() {
  return (
    <div className="gallery-loading">
      <div className="gallery-loading-spinner" />
      <p>Loading...</p>
    </div>
  );
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className="gallery-page">
      {/* Hero Section */}
      <GalleryHero />

      {/* Gallery Content */}
      <section className="gallery-main">
        <div className="container">
          <Suspense fallback={<GalleryLoading />}>
            <GalleryContent
              year={params.year}
              category={params.category}
              search={params.search}
              page={params.page}
            />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
