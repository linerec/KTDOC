'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import type { GalleryPhoto } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';
import { lockBodyScroll } from '@/lib/bodyScrollLock';

interface PhotoStreamSectionProps {
  photos: GalleryPhoto[];
}

function formatPhotoDate(dateStr: string | null, locale: 'ko' | 'en') {
  if (!dateStr) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return formatter.format(new Date(dateStr));
}

export default function PhotoStreamSection({ photos }: PhotoStreamSectionProps) {
  const { locale } = useLanguage();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openLightbox = useCallback((index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  // 배경 스크롤 잠금은 여는/닫는 함수가 아니라 열림 상태에 매단다 — 닫지 않고
  // 떠나는 경로(뒤로가기)에서도 정리 함수가 불려 body가 잠긴 채 남지 않는다.
  useEffect(() => {
    if (!lightboxOpen) return;
    return lockBodyScroll();
  }, [lightboxOpen]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  }, [photos.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  }, [photos.length]);

  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') goToPrevious();
      if (event.key === 'ArrowRight') goToNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, closeLightbox, goToPrevious, goToNext]);

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];
  const currentCaption = currentPhoto
    ? locale === 'ko'
      ? currentPhoto.caption_ko
      : (currentPhoto.caption_en || currentPhoto.caption_ko)
    : null;
  const currentDate = currentPhoto ? formatPhotoDate(currentPhoto.taken_date, locale) : null;

  return (
    <section className="gallery-photo-stream">
      <div className="gallery-photo-stream-grid">
        {photos.map((photo, index) => {
          const caption = locale === 'ko'
            ? photo.caption_ko
            : (photo.caption_en || photo.caption_ko);
          const date = formatPhotoDate(photo.taken_date, locale);
          const eventTitle = locale === 'ko'
            ? photo.event_title_ko
            : (photo.event_title_en || photo.event_title_ko);
          const hasMeta = Boolean(date || caption || eventTitle);
          const orientation = photo.width && photo.height
            ? photo.width > photo.height * 1.12
              ? 'landscape'
              : photo.height > photo.width * 1.12
                ? 'portrait'
                : 'square'
            : 'square';

          return (
            <button
              type="button"
              className={`gallery-photo-stream-card gallery-photo-stream-card--${orientation}`}
              key={photo.id}
              onClick={() => openLightbox(index)}
              aria-label={caption || `${locale === 'ko' ? '사진 크게 보기' : 'Open photo'} ${index + 1}`}
            >
              <div className="gallery-photo-stream-image">
                <Image
                  src={photo.image_url}
                  alt={caption || 'Gallery photo'}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 260px"
                  className="gallery-photo-stream-img"
                />
              </div>
              {hasMeta ? (
                <div className="gallery-photo-stream-meta">
                  {date ? <span>{date}</span> : null}
                  {caption ? <strong>{caption}</strong> : null}
                  {eventTitle ? (
                  <em>
                    {eventTitle}
                  </em>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {lightboxOpen && currentPhoto && (
        <div className="gallery-lightbox" onClick={closeLightbox}>
          <div
            className="gallery-lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="gallery-lightbox-close"
              onClick={closeLightbox}
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="gallery-lightbox-nav gallery-lightbox-prev"
                  onClick={goToPrevious}
                  aria-label="Previous"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="gallery-lightbox-nav gallery-lightbox-next"
                  onClick={goToNext}
                  aria-label="Next"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </>
            )}

            <div className="gallery-lightbox-image">
              <Image
                src={currentPhoto.image_url}
                alt={currentCaption || `Gallery photo ${currentIndex + 1}`}
                fill
                sizes="100vw"
                className="gallery-lightbox-img"
                priority
              />
            </div>

            <div className="gallery-lightbox-info">
              {currentCaption ? (
                <p className="gallery-lightbox-caption">{currentCaption}</p>
              ) : null}
              {currentDate ? (
                <p className="gallery-lightbox-caption">{currentDate}</p>
              ) : null}
              <span className="gallery-lightbox-counter">
                {currentIndex + 1} / {photos.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
