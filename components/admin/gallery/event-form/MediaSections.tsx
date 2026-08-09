'use client';

/**
 * 사진·영상 섹션 — 이미 저장된 공연에서만 보인다
 *
 * 업로드가 공연 id로 가는 API라 신규 작성 중에는 붙일 곳이 없다.
 * (신규 저장 직후 편집 화면으로 넘어가면서 이 섹션이 나타난다.)
 */

import type { EventImage, EventVideo } from '@/types/gallery';
import ImageUploader from '../ImageUploader';
import ImageSortable from '../ImageSortable';
import VideoManager from '../VideoManager';
import { useT } from '@/lib/i18n/useT';

interface MediaSectionsProps {
  eventId: number;
  images: EventImage[];
  onImagesChange: (images: EventImage[]) => void;
  videos: EventVideo[];
  onVideosChange: (videos: EventVideo[]) => void;
}

export default function MediaSections({
  eventId,
  images,
  onImagesChange,
  videos,
  onVideosChange,
}: MediaSectionsProps) {
  const t = useT();

  return (
    <>
      <div className="admin-form-section">
        <h3 className="admin-form-section-title">
          {t('admin.events.photoSection', '이 공연의 사진')}
        </h3>
        <p className="admin-form-help">
          {t(
            'admin.events.photoHelp',
            '업로드한 사진은 이 공연 상세 페이지의 사진 영역에 표시됩니다. 공연 목록·홈 카드에 쓰이는 대표 사진은 아래에서 지정할 수 있습니다.'
          )}
        </p>
        <ImageUploader
          eventId={eventId}
          onUploadComplete={(newImages) => onImagesChange([...images, ...newImages])}
        />
        {images.length > 0 && (
          <ImageSortable
            eventId={eventId}
            images={images}
            onReorder={onImagesChange}
            onDelete={(imageId) => onImagesChange(images.filter((img) => img.id !== imageId))}
          />
        )}
      </div>

      <div className="admin-form-section">
        <h3 className="admin-form-section-title">
          {t('admin.events.videoSection', '이 공연의 영상')}
        </h3>
        <p className="admin-form-help">
          {t(
            'admin.events.videoHelp',
            'YouTube 영상 링크를 추가하면 이 공연 상세 페이지의 영상 영역에 표시됩니다.'
          )}
        </p>
        <VideoManager
          eventId={eventId}
          videos={videos}
          onAdd={(video) => onVideosChange([...videos, video])}
          onDelete={(videoId) => onVideosChange(videos.filter((v) => v.id !== videoId))}
        />
      </div>
    </>
  );
}
