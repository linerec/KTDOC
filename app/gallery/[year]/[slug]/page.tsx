/**
 * Gallery Event Detail Page
 * 이벤트 상세 페이지
 */

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getEventBySlug, getAdjacentEvents, incrementViewCount } from '@/lib/d1';
import { getCalendarConfig, buildAddToCalendarLinks } from '@/lib/calendar';
import { formatEventDate } from '@/types/gallery';
import IntlObject from '@/components/common/IntlObject';
import EventLocationMap from '@/components/events/EventLocationMap';
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

// 이벤트 상세 사진 갤러리 한 페이지 분량 (수천 장이어도 첫 묶음만 로드 후 '더 보기')
const GALLERY_IMAGE_PAGE_SIZE = 24;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year, slug } = await params;
  // 메타데이터는 OG 이미지 한 장만 필요 → 이미지 1장만 로드
  const event = await getEventBySlug(parseInt(year), slug, { imagesLimit: 1 });

  if (!event) {
    return {
      title: 'Event Not Found | KTDOC Gallery',
    };
  }

  return {
    title: `${event.title_ko} | KTDOC Gallery`,
    description: event.description_ko || `${event.title_ko} - ${year}년 공연 아카이브`,
    alternates: {
      canonical: `/gallery/${year}/${slug}`,
    },
    openGraph: {
      title: event.title_ko,
      description: event.description_ko || undefined,
      url: `/gallery/${year}/${slug}`,
      type: 'article',
      siteName: 'KTDOC',
      locale: 'ko_KR',
      images: [
        {
          url: event.poster_url || event.thumbnail_url || event.images[0]?.image_url || '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: event.title_ko,
        },
      ],
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
  let event = await getEventBySlug(yearNum, slug, { imagesLimit: GALLERY_IMAGE_PAGE_SIZE });

  // If not found, try with decoded slug
  if (!event && slug !== decodedSlug) {
    console.log('[Gallery Detail] Trying decoded slug:', decodedSlug);
    event = await getEventBySlug(yearNum, decodedSlug, { imagesLimit: GALLERY_IMAGE_PAGE_SIZE });
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

  // "내 캘린더에 추가" 링크(기기 .ics / 구글). 요청 host 기준 절대 URL.
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'ktdoc.org';
  const proto = hdrs.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const calTz = (await getCalendarConfig()).timezone;
  const calLinks = buildAddToCalendarLinks(event, `${proto}://${host}`, calTz);

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

          {/* 내 캘린더에 추가 (ko/en) */}
          <div className="gallery-detail-cal">
            <a className="gallery-cal-btn gallery-cal-btn--primary" href={calLinks.icsUrl}>
              <span aria-hidden="true">📅</span>
              <IntlObject keycode="pages.calendar.sub.addDevice" />
            </a>
            <a
              className="gallery-cal-btn"
              href={calLinks.googleUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IntlObject keycode="pages.calendar.sub.addGoogle" />
            </a>
          </div>
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

      {/* 오시는 길 — 좌표가 있으면 지도, 없으면 장소명·링크만 */}
      {(event.location ||
        event.location_address ||
        (event.location_lat !== null && event.location_lng !== null) ||
        event.location_url) && (
        <section className="gallery-detail-location">
          <div className="container">
            <GallerySectionTitle keycode="gallery.detail.location" />
            <EventLocationMap
              location={event.location}
              address={event.location_address}
              lat={event.location_lat}
              lng={event.location_lng}
              locationUrl={event.location_url}
              directionsLabel={<IntlObject keycode="gallery.detail.directions" />}
              largerMapLabel={<IntlObject keycode="gallery.detail.largerMap" />}
            />
          </div>
        </section>
      )}

      {/* Photo Gallery */}
      {event.images && event.images.length > 0 && (
        <section className="gallery-detail-images">
          <div className="container">
            <GallerySectionTitle keycode="gallery.detail.photoGallery" />
            <ImageGallery
              images={event.images}
              total={event.image_total ?? event.images.length}
              loadMoreUrl={`/api/gallery/events/${event.id}/images`}
              pageSize={GALLERY_IMAGE_PAGE_SIZE}
              locale="ko"
            />
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
