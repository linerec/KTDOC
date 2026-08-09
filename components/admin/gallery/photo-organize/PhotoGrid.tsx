'use client';

/**
 * 사진 타일 그리드
 *
 * 배지가 '이 사진이 지금 어디까지 정리됐는지'를 말한다. '연결 대기'가 특히 중요한데,
 * 공연은 지정됐지만 아직 공연 사진으로 게시되지 않은 어중간한 상태다 — 그냥 두면
 * 공개 페이지에 나타나지 않는다.
 */

import Image from 'next/image';
import type { GalleryPhoto } from '@/types/gallery';
import { useT } from '@/lib/i18n/useT';
import type { ViewDensity } from './types';

interface PhotoGridProps {
  photos: GalleryPhoto[];
  selected: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpenDetail: (id: number) => void;
  density: ViewDensity;
  loading: boolean;
  hasActiveFilters: boolean;
}

export default function PhotoGrid({
  photos,
  selected,
  onToggleSelect,
  onOpenDetail,
  density,
  loading,
  hasActiveFilters,
}: PhotoGridProps) {
  const t = useT();

  if (photos.length === 0) {
    return (
      <section className={`photo-organize-grid density-${density} ${loading ? 'is-loading' : ''}`}>
        <div className="admin-empty-state photo-organize-empty">
          <p>
            {hasActiveFilters
              ? t('admin.photos.emptyFiltered', '조건에 맞는 사진이 없습니다.')
              : t('admin.photos.empty', '아직 보관함에 올라온 사진이 없습니다.')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={`photo-organize-grid density-${density} ${loading ? 'is-loading' : ''}`}>
      {photos.map((photo) => {
        const isSelected = selected.has(photo.id);
        return (
          <article key={photo.id} className={`photo-tile ${isSelected ? 'is-selected' : ''}`}>
            <button
              type="button"
              className="photo-tile-img-btn"
              onClick={() => onOpenDetail(photo.id)}
              title={t('admin.photos.openDetail', '상세 편집')}
            >
              <Image
                src={photo.image_url}
                alt={photo.caption_ko || 'Gallery photo'}
                fill
                sizes="(max-width: 768px) 33vw, 180px"
                className="photo-tile-img"
                loading="lazy"
              />
            </button>

            <label
              className="photo-tile-check admin-form-checkbox"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(photo.id)}
                aria-label={t('admin.photos.selectAria', '선택')}
              />
            </label>

            <div className="photo-tile-badges">
              {photo.is_published === 1 && (
                <span className="photo-tile-badge is-public">
                  {t('admin.common.published', '공개')}
                </span>
              )}
              {photo.uploaded_by && (
                <span
                  className="photo-tile-badge is-submitted"
                  title={
                    photo.uploader_name
                      ? t('admin.photos.fromStudentBy', '학생 제출 · {name}', {
                          name: photo.uploader_name,
                        })
                      : t('admin.photos.fromStudent', '학생 제출')
                  }
                >
                  {t('admin.photos.fromStudent', '학생 제출')}
                </span>
              )}
              {photo.event_image_id ? (
                <span className="photo-tile-badge is-linked">
                  {t('admin.schedule.typePerformance', '공연')}
                </span>
              ) : photo.event_id ? (
                <span
                  className="photo-tile-badge is-pending"
                  title={t(
                    'admin.photos.pendingTitle',
                    "공연이 지정됐지만 아직 공연 사진으로 게시되지 않았습니다. 사진을 열어 정리 저장하거나 '공연에 넣기'를 실행하세요."
                  )}
                >
                  {t('admin.photos.pending', '연결 대기')}
                </span>
              ) : (
                <span className="photo-tile-badge is-loose">
                  {t('admin.photos.unassigned', '미분류')}
                </span>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
