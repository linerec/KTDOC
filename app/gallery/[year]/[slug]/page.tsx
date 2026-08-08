/**
 * Gallery Event Detail Page
 * 이벤트 상세 페이지
 */

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  getEventBySlug,
  getAdjacentEvents,
  incrementViewCount,
  getCheckinCountsByEvent,
} from '@/lib/d1';
import { getCalendarConfig, buildAddToCalendarLinks } from '@/lib/calendar';
import { formatEventDate, formatEventTimeRange } from '@/types/gallery';
import IntlObject from '@/components/common/IntlObject';
import EventLocationMap from '@/components/events/EventLocationMap';
import EventDescription from '@/components/gallery/EventDescription';
import ImageGallery from '@/components/gallery/ImageGallery';
import { VideoList } from '@/components/gallery/VideoEmbed';
import GalleryBackLink from '@/components/gallery/GalleryBackLink';
import GalleryAdjacentNav from '@/components/gallery/GalleryAdjacentNav';
import GallerySectionTitle from '@/components/gallery/GallerySectionTitle';
import EventDetailFacts from '@/components/gallery/EventDetailFacts';
import ShareQrCard from '@/components/share/ShareQrCard';

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
      title: 'Event Not Found',
    };
  }

  return {
    title: event.title_ko,
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

  if (isNaN(yearNum)) {
    notFound();
  }

  // slug에 한글이 들어가는 공연이 있어 인코딩된 값과 디코딩된 값을 모두 시도한다
  const decodedSlug = decodeURIComponent(slug);
  let event = await getEventBySlug(yearNum, slug, { imagesLimit: GALLERY_IMAGE_PAGE_SIZE });
  if (!event && slug !== decodedSlug) {
    event = await getEventBySlug(yearNum, decodedSlug, { imagesLimit: GALLERY_IMAGE_PAGE_SIZE });
  }

  if (!event || !event.is_published) {
    notFound();
  }

  // Track view count (fire and forget)
  incrementViewCount(event.id).catch(() => {});

  // Get adjacent events for navigation
  const adjacent = await getAdjacentEvents(event.id, event.year);

  const formattedDate = formatEventDate(event.event_date, 'ko');
  // 집합 시간은 넘기지 않는다 — 출연자용 내부 정보다(formatEventTimeRange 주석).
  const formattedTime = formatEventTimeRange(event.start_time, event.end_time, 'ko');

  // "내 캘린더에 추가" 링크(기기 .ics / 구글). 요청 host 기준 절대 URL.
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'ktdoc.org';
  const proto = hdrs.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const calTz = (await getCalendarConfig()).timezone;
  const calLinks = buildAddToCalendarLinks(event, `${proto}://${host}`, calTz);

  // 학내 행사에 한해 참여 인원을 집계한다 — 이름은 노출하지 않는다(미성년자 개인정보).
  // "우리는 제대로 합니다"라는 주장 대신 실제 참여 규모라는 사실만 남긴다.
  let participantCount = 0;
  if (event.kind === 'school') {
    const counts = await getCheckinCountsByEvent([event.id]);
    participantCount = counts.get(event.id) ?? 0;
  }

  // 히어로 배경은 '분위기'를 맡으므로 가로 사진을 우선한다. 포스터(대개 세로 전단)를
  // cover로 깔면 글자가 잘려 정보가 사라지므로, 포스터는 사이드바에서 통째로 보여 준다.
  const heroImage = event.thumbnail_url || event.images[0]?.image_url || event.poster_url;
  const hasLocationSection =
    event.location ||
    event.location_address ||
    (event.location_lat !== null && event.location_lng !== null) ||
    event.location_url;

  return (
    <main className="event-detail">
      <section className="event-detail-hero">
        {heroImage && (
          <div className="event-detail-hero-bg" aria-hidden="true">
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="event-detail-hero-img"
            />
          </div>
        )}
        <div className="event-detail-hero-overlay" aria-hidden="true" />
        <div className="container event-detail-hero-inner">
          <div className="event-detail-eyebrow">
            <GalleryBackLink kind={event.kind} className="event-detail-back" />
            <span className="event-detail-year">{event.year}</span>
            {event.kind === 'school' && <span className="event-detail-kind">학내 행사</span>}
            {event.category && (
              <span className="event-detail-category">{event.category.name_ko}</span>
            )}
          </div>
          <h1 className="event-detail-title">{event.title_ko}</h1>
          {event.title_en && <p className="event-detail-title-en">{event.title_en}</p>}
          <p className="event-detail-when">
            {formattedDate}
            {formattedTime && <span className="event-detail-time">{formattedTime}</span>}
            {event.location && <span className="event-detail-venue">{event.location}</span>}
          </p>
        </div>
      </section>

      <section className="event-detail-body">
        <div className="container event-detail-grid">
          <div className="event-detail-content">
            {(event.description_ko || event.description_en) && (
              <div className="event-detail-description">
                {event.description_ko && (
                  <EventDescription text={event.description_ko} className="gallery-description-ko" />
                )}
                {event.description_en && (
                  <EventDescription text={event.description_en} className="gallery-description-en" />
                )}
              </div>
            )}

            {hasLocationSection && (
              <div className="event-detail-section">
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
            )}

            {event.images && event.images.length > 0 && (
              <div className="event-detail-section">
                <span className="dancheong-divider" aria-hidden="true" />
                <GallerySectionTitle keycode="gallery.detail.photoGallery" />
                <ImageGallery
                  images={event.images}
                  total={event.image_total ?? event.images.length}
                  loadMoreUrl={`/api/gallery/events/${event.id}/images`}
                  pageSize={GALLERY_IMAGE_PAGE_SIZE}
                  locale="ko"
                />
              </div>
            )}

            {event.videos && event.videos.length > 0 && (
              <div className="event-detail-section">
                <GallerySectionTitle keycode="gallery.detail.videos" />
                <VideoList videos={event.videos} locale="ko" />
              </div>
            )}
          </div>

          <aside className="event-detail-aside">
            {/* 포스터는 세로 전단이라 잘리면 안 된다 — 사이드바에서 원래 비율로 */}
            {event.poster_url && (
              <div className="event-poster-card">
                <Image
                  src={event.poster_url}
                  alt={event.title_ko}
                  width={800}
                  height={1200}
                  className="event-poster-img"
                  sizes="(max-width: 980px) 100vw, 340px"
                />
              </div>
            )}
            <EventDetailFacts
              date={formattedDate}
              time={formattedTime}
              location={event.location}
              address={event.location_address}
              participantCount={event.kind === 'school' ? participantCount : 0}
              icsUrl={calLinks.icsUrl}
              googleUrl={calLinks.googleUrl}
            />
            <ShareQrCard title={event.title_ko} />
          </aside>
        </div>
      </section>

      <GalleryAdjacentNav prev={adjacent.prev} next={adjacent.next} />
    </main>
  );
}
