'use client';

/**
 * GalleryBackLink — 상세에서 목록으로 돌아가는 링크
 *
 * 목록 주소는 하나(/gallery)지만 그 안에는 공연과 학내 행사가 섞여 있다.
 * 공연 상세에서 "갤러리로 돌아가기"라고 하면 사진첩으로 가는 것처럼 읽혀
 * 지금 보고 있는 것이 무엇인지 흐려진다. 그래서 문구를 종류에 맞춘다.
 */

import Link from 'next/link';
import { useT } from '@/lib/i18n/useT';

interface GalleryBackLinkProps {
  /** 'school'이면 학내 행사, 그 밖은 공연으로 부른다. 생략하면 종전 문구. */
  kind?: string | null;
  className?: string;
}

export default function GalleryBackLink({ kind, className }: GalleryBackLinkProps) {
  const t = useT();
  const label =
    kind === 'school'
      ? t('gallery.backToSchool', '행사 기록으로')
      : kind
      ? t('gallery.backToPerformances', '공연 기록으로')
      : t('gallery.backToGallery', '갤러리로 돌아가기');

  return (
    <Link href="/gallery" className={className ?? 'gallery-back-link'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </Link>
  );
}
