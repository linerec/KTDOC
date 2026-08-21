'use client';

/**
 * ImageGallery Component
 * 라이트박스 이미지 갤러리 - 전체화면 보기 지원
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { lockBodyScroll } from '@/lib/bodyScrollLock';

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
  /** 전체 이미지 수 (페이지네이션 시 images는 첫 묶음). 미지정 시 images.length */
  total?: number;
  /** 추가 이미지를 가져올 API base URL. 지정 시 '더 보기' 활성화 (예: /api/gallery/events/12/images) */
  loadMoreUrl?: string;
  /** 한 번에 더 불러올 개수 (loadMoreUrl과 함께 사용). 기본 images.length 또는 24 */
  pageSize?: number;
}

export default function ImageGallery({
  images,
  locale = 'ko',
  total: totalProp,
  loadMoreUrl,
  pageSize: pageSizeProp,
}: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [extraImages, setExtraImages] = useState<GalleryLightboxImage[]>([]);
  const [total, setTotal] = useState(totalProp ?? images.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // 서버 렌더된 첫 묶음 + 클라이언트에서 추가로 불러온 묶음
  const allImages = useMemo(
    () => [...images, ...extraImages],
    [images, extraImages]
  );

  const pageSize = pageSizeProp || images.length || 24;
  const hasMore = Boolean(loadMoreUrl) && allImages.length < total;

  const loadMore = useCallback(async () => {
    if (!loadMoreUrl || loadingMore) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const nextPage = Math.floor(allImages.length / pageSize) + 1;
      const separator = loadMoreUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${loadMoreUrl}${separator}page=${nextPage}&limit=${pageSize}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'failed');
      setExtraImages((cur) => [...cur, ...(data.data.images as GalleryLightboxImage[])]);
      if (typeof data.data.total === 'number') setTotal(data.data.total);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadMoreUrl, loadingMore, allImages.length, pageSize]);

  const openLightbox = useCallback((index: number) => {
    lastFocusedRef.current = (document.activeElement as HTMLElement) || null;
    setCurrentIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    lastFocusedRef.current?.focus();
  }, []);

  // 배경 스크롤 잠금은 여는/닫는 함수가 아니라 열림 상태에 매단다 — 닫지 않고
  // 떠나는 경로(뒤로가기)에서도 정리 함수가 불려 body가 잠긴 채 남지 않는다.
  useEffect(() => {
    if (!lightboxOpen) return;
    return lockBodyScroll();
  }, [lightboxOpen]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  }, [allImages.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  }, [allImages.length]);

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

  if (allImages.length === 0) {
    return (
      <div className="gallery-images-empty">
        <p>{locale === 'ko' ? '등록된 이미지가 없습니다.' : 'No images available.'}</p>
      </div>
    );
  }

  const currentImage = allImages[currentIndex];
  const caption = locale === 'ko'
    ? currentImage?.caption_ko
    : (currentImage?.caption_en || currentImage?.caption_ko);

  return (
    <>
      {/* Image Grid */}
      <div className="gallery-images-grid">
        {allImages.map((image, index) => (
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

      {/* Load More (페이지네이션) */}
      {(hasMore || loadError) && (
        <div className="gallery-load-more">
          {loadError && (
            <p className="gallery-load-more-error">
              {locale === 'ko'
                ? '이미지를 불러오지 못했습니다.'
                : 'Failed to load images.'}
            </p>
          )}
          <button
            type="button"
            className="gallery-load-more-btn"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore
              ? locale === 'ko' ? '불러오는 중...' : 'Loading...'
              : loadError
                ? locale === 'ko' ? '다시 시도' : 'Retry'
                : locale === 'ko' ? '사진 더 보기' : 'Load more'}
          </button>
          <span className="gallery-load-more-count">
            {allImages.length} / {total}
          </span>
        </div>
      )}

      {/* Lightbox */}
      {/* 라이트박스는 body에 포털로 붙인다. 갤러리가 놓인 자리에 그대로 그리면
          조상이 만든 쌓임 맥락(예: main.program-detail의 isolation: isolate)에
          갇혀, z-index가 아무리 높아도 헤더 아래로 깔린다. 그러면 스크림이 헤더를
          덮지 못하고 우상단 닫기 버튼이 헤더에 가려 눌리지도 않는다. */}
      {lightboxOpen && currentImage &&
        createPortal(
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
            {allImages.length > 1 && (
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
                {currentIndex + 1} / {total}
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
