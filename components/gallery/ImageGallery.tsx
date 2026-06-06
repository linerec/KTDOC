'use client';

/**
 * ImageGallery Component
 * 라이트박스 이미지 갤러리 - 전체화면 보기 지원
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';

// 구조적 최소 타입 — EventImage / ProgramImage 모두 호환 (라이트박스 재사용용)
interface GalleryLightboxImage {
  id: number;
  image_url: string;
  caption_ko: string | null;
  caption_en: string | null;
}

interface ImageGalleryProps {
  images: GalleryLightboxImage[];
  locale?: 'ko' | 'en';
}

export default function ImageGallery({ images, locale = 'ko' }: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const openLightbox = useCallback((index: number) => {
    lastFocusedRef.current = (document.activeElement as HTMLElement) || null;
    setCurrentIndex(index);
    setLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    document.body.style.overflow = '';
    lastFocusedRef.current?.focus();
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, closeLightbox, goToPrevious, goToNext]);

  if (images.length === 0) {
    return (
      <div className="gallery-images-empty">
        <p>{locale === 'ko' ? '등록된 이미지가 없습니다.' : 'No images available.'}</p>
      </div>
    );
  }

  const currentImage = images[currentIndex];
  const caption = locale === 'ko'
    ? currentImage?.caption_ko
    : (currentImage?.caption_en || currentImage?.caption_ko);

  return (
    <>
      {/* Image Grid */}
      <div className="gallery-images-grid">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            className="gallery-image-item"
            onClick={() => openLightbox(index)}
          >
            <Image
              src={image.image_url}
              alt={
                (locale === 'ko' ? image.caption_ko : image.caption_en) ||
                `Image ${index + 1}`
              }
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              className="gallery-image-thumb"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && currentImage && (
        <div className="gallery-lightbox" onClick={closeLightbox}>
          <div
            className="gallery-lightbox-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={locale === 'ko' ? '이미지 갤러리' : 'Image gallery'}
          >
            {/* Close Button */}
            <button
              type="button"
              ref={closeButtonRef}
              className="gallery-lightbox-close"
              onClick={closeLightbox}
              aria-label={locale === 'ko' ? '닫기' : 'Close'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Navigation */}
            {images.length > 1 && (
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

            {/* Image */}
            <div className="gallery-lightbox-image">
              <Image
                src={currentImage.image_url}
                alt={caption || `Image ${currentIndex + 1}`}
                fill
                sizes="100vw"
                className="gallery-lightbox-img"
                priority
              />
            </div>

            {/* Caption & Counter */}
            <div className="gallery-lightbox-info">
              {caption && (
                <p className="gallery-lightbox-caption">{caption}</p>
              )}
              <span className="gallery-lightbox-counter">
                {currentIndex + 1} / {images.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
