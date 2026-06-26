'use client';

import { useCallback, useEffect } from 'react';
import Image from 'next/image';
import type { GalleryPhoto } from '@/types/gallery';

interface PhotoLightboxProps {
  photos: GalleryPhoto[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}

/**
 * 보관함 정리용 경량 라이트박스.
 * 현재 페이지의 사진 배열을 좌/우/ESC로 넘기며 원본을 확대 확인한다.
 */
export default function PhotoLightbox({ photos, index, onClose, onIndexChange }: PhotoLightboxProps) {
  const photo = photos[index];

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < photos.length) onIndexChange(next);
    },
    [index, photos.length, onIndexChange]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  if (!photo) return null;

  return (
    <div className="photo-lightbox" onClick={onClose}>
      <button type="button" className="photo-lightbox-close" onClick={onClose} aria-label="닫기">
        &times;
      </button>

      {index > 0 && (
        <button
          type="button"
          className="photo-lightbox-nav photo-lightbox-prev"
          onClick={(e) => { e.stopPropagation(); go(-1); }}
          aria-label="이전 사진"
        >
          ‹
        </button>
      )}

      <div className="photo-lightbox-stage" onClick={(e) => e.stopPropagation()}>
        <Image
          src={photo.image_url}
          alt={photo.caption_ko || 'Gallery photo'}
          fill
          sizes="100vw"
          className="photo-lightbox-img"
          unoptimized
        />
        <div className="photo-lightbox-caption">
          <span>{photo.caption_ko || '캡션 없음'}</span>
          <span className="photo-lightbox-count">{index + 1} / {photos.length}</span>
        </div>
      </div>

      {index < photos.length - 1 && (
        <button
          type="button"
          className="photo-lightbox-nav photo-lightbox-next"
          onClick={(e) => { e.stopPropagation(); go(1); }}
          aria-label="다음 사진"
        >
          ›
        </button>
      )}
    </div>
  );
}
