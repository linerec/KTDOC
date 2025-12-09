'use client';

/**
 * GallerySectionTitle Component
 * 갤러리 섹션 제목
 */

import IntlObject from '@/components/common/IntlObject';

interface GallerySectionTitleProps {
  keycode: string;
}

export default function GallerySectionTitle({ keycode }: GallerySectionTitleProps) {
  return (
    <IntlObject keycode={keycode} returnType="h2" className="gallery-section-title" />
  );
}
