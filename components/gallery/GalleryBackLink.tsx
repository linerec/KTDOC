'use client';

/**
 * GalleryBackLink Component
 * 갤러리로 돌아가기 링크
 */

import Link from 'next/link';
import IntlObject from '@/components/common/IntlObject';

export default function GalleryBackLink() {
  return (
    <div className="gallery-detail-nav">
      <div className="container">
        <Link href="/gallery" className="gallery-back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <IntlObject keycode="gallery.backToGallery" />
        </Link>
      </div>
    </div>
  );
}
