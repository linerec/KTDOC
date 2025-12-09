'use client';

/**
 * GalleryEmptyState Component
 * 검색 결과가 없을 때 표시
 */

import IntlObject from '@/components/common/IntlObject';

export default function GalleryEmptyState() {
  return (
    <div className="gallery-empty">
      <IntlObject keycode="gallery.empty" returnType="p" />
    </div>
  );
}
