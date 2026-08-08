/**
 * Gallery Page
 * 공연 아카이브 목록 페이지
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getEvents, getCategories, getGalleryPhotos, publicArchive} from '@/lib/d1';
import GalleryHero from '@/components/gallery/GalleryHero';
import GalleryFilter from '@/components/gallery/GalleryFilter';
import YearSection from '@/components/gallery/YearSection';
import GalleryEmptyState from '@/components/gallery/GalleryEmptyState';
import PhotoStreamSection from '@/components/gallery/PhotoStreamSection';
import type { EventWithCategory } from '@/types/gallery';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Performances Through the Years - Korean Traditional Dance of Choomnoori archive',
  alternates: {
    canonical: '/gallery',
  },
  openGraph: {
    title: 'Gallery | KTDOC',
    description: 'Performances Through the Years - Korean Traditional Dance of Choomnoori archive',
    url: '/gallery',
    images: [
      {
        url: '/og-image.jpg',
        width: 600,
        height: 400,
        alt: 'KTDOC - Korean Traditional Dance of Choomnoori',
      },
    ],
  },
};

interface PageProps {
  searchParams: Promise<{
    year?: string;
    category?: string;
    search?: string;
    page?: string;
    kind?: string;
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
  kind,
}: {
  year?: string;
  category?: string;
  search?: string;
  page?: string;
  kind?: string;
}) {
  const shouldShowPhotoStream = !year && !category && !search && !kind;
  const [eventsResult, categories, photoStream] = await Promise.all([
    getEvents(
      publicArchive({
        year: year ? parseInt(year) : undefined,
        category: category || undefined,
        search: search || undefined,
        page: page ? parseInt(page) : 1,
        kind,
      })
    ),
    getCategories(),
    shouldShowPhotoStream
      ? getGalleryPhotos({ published: true, limit: 24 })
      : Promise.resolve({ photos: [], total: 0 }),
  ]);

  const { events, years } = eventsResult;
  const groupedEvents = groupEventsByYear(events);
  const sortedYears = Array.from(groupedEvents.keys()).sort((a, b) => b - a);

  return (
    <>
      <GalleryFilter years={years} categories={categories} />
      <PhotoStreamSection photos={photoStream.photos} />

      {events.length === 0 && photoStream.photos.length === 0 ? (
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
              kind={params.kind}
            />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
