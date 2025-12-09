/**
 * Gallery Event Detail Page
 * 이벤트 상세 페이지
 */

import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getEventBySlug, getAdjacentEvents, incrementViewCount } from '@/lib/d1';
import { formatEventDate } from '@/types/gallery';
import ImageGallery from '@/components/gallery/ImageGallery';
import { VideoList } from '@/components/gallery/VideoEmbed';
import GalleryBackLink from '@/components/gallery/GalleryBackLink';
import GalleryAdjacentNav from '@/components/gallery/GalleryAdjacentNav';
import GallerySectionTitle from '@/components/gallery/GallerySectionTitle';

interface PageProps {
  params: Promise<{
    year: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year, slug } = await params;
  const event = await getEventBySlug(parseInt(year), slug);

  if (!event) {
    return {
      title: 'Event Not Found | KTDOC Gallery',
    };
  }

  return {
    title: `${event.title_ko} | KTDOC Gallery`,
    description: event.description_ko || `${event.title_ko} - ${year}년 공연 아카이브`,
    openGraph: {
      title: event.title_ko,
      description: event.description_ko || undefined,
      images: event.poster_url ? [event.poster_url] : undefined,
    },
  };
}

export default async function EventDetailPage({ params }: PageProps) {
  const { year, slug } = await params;
  const yearNum = parseInt(year);

  // Debug logging
  console.log('[Gallery Detail] year:', year, 'slug:', slug, 'decoded:', decodeURIComponent(slug));

  if (isNaN(yearNum)) {
    notFound();
  }

  // Try both encoded and decoded slug
  const decodedSlug = decodeURIComponent(slug);
  let event = await getEventBySlug(yearNum, slug);

  // If not found, try with decoded slug
  if (!event && slug !== decodedSlug) {
    console.log('[Gallery Detail] Trying decoded slug:', decodedSlug);
    event = await getEventBySlug(yearNum, decodedSlug);
  }

  console.log('[Gallery Detail] Event found:', !!event, event?.is_published);

  if (!event || !event.is_published) {
    notFound();
  }

  // Track view count (fire and forget)
  incrementViewCount(event.id).catch(() => {});

  // Get adjacent events for navigation
  const adjacent = await getAdjacentEvents(event.id, event.year);

  const formattedDate = formatEventDate(event.event_date, 'ko');

  return (
    <main className="gallery-detail-page">
      {/* Back Navigation */}
      <GalleryBackLink />

      {/* Event Header */}
      <section className="gallery-detail-header">
        <div className="container">
          <div className="gallery-detail-meta">
            <span className="gallery-detail-year">{event.year}</span>
            {event.category && (
              <span className="gallery-detail-category">
                {event.category.name_ko}
              </span>
            )}
          </div>
          <h1 className="gallery-detail-title">{event.title_ko}</h1>
          {event.title_en && (
            <p className="gallery-detail-title-en">{event.title_en}</p>
          )}
          <p className="gallery-detail-date">{formattedDate}</p>
        </div>
      </section>

      {/* Poster Image */}
      {event.poster_url && (
        <section className="gallery-detail-poster">
          <div className="container">
            <div className="gallery-poster-wrapper">
              <Image
                src={event.poster_url}
                alt={event.title_ko}
                width={800}
                height={1200}
                className="gallery-poster-img"
                priority
              />
            </div>
          </div>
        </section>
      )}

      {/* Description */}
      {(event.description_ko || event.description_en) && (
        <section className="gallery-detail-description">
          <div className="container">
            {event.description_ko && (
              <div className="gallery-description-ko">
                <p>{event.description_ko}</p>
              </div>
            )}
            {event.description_en && (
              <div className="gallery-description-en">
                <p>{event.description_en}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Photo Gallery */}
      {event.images && event.images.length > 0 && (
        <section className="gallery-detail-images">
          <div className="container">
            <GallerySectionTitle keycode="gallery.detail.photoGallery" />
            <ImageGallery images={event.images} locale="ko" />
          </div>
        </section>
      )}

      {/* Videos */}
      {event.videos && event.videos.length > 0 && (
        <section className="gallery-detail-videos">
          <div className="container">
            <GallerySectionTitle keycode="gallery.detail.videos" />
            <VideoList videos={event.videos} locale="ko" />
          </div>
        </section>
      )}

      {/* Adjacent Navigation */}
      <GalleryAdjacentNav prev={adjacent.prev} next={adjacent.next} />
    </main>
  );
}
