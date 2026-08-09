'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import type { GalleryPhoto } from '@/types/gallery';
import PhotoUploadPanel from './PhotoUploadPanel';
import PhotoOrganizeBoard from './PhotoOrganizeBoard';

interface PhotoInboxManagerProps {
  initialPhotos: GalleryPhoto[];
  initialTotal: number;
  pageSize: number;
}

type Tab = 'upload' | 'organize';

/**
 * 사진 보관함 셸 — 업로드 / 사진 정리 두 공간을 탭으로 분리한다.
 * 정리 보드는 상태 유지를 위해 항상 마운트하고 탭으로 표시만 토글한다.
 * 업로드 성공 시 reloadSignal을 올려 정리 보드를 1페이지부터 새로고침한다.
 */
export default function PhotoInboxManager({
  initialPhotos,
  initialTotal,
  pageSize,
}: PhotoInboxManagerProps) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('organize');
  const [reloadSignal, setReloadSignal] = useState(0);

  const handleUploaded = () => {
    setReloadSignal((n) => n + 1);
    setTab('organize');
  };

  return (
    <div className="photo-inbox">
      <div className="photo-inbox-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upload'}
          className={`photo-inbox-tab ${tab === 'upload' ? 'is-active' : ''}`}
          onClick={() => setTab('upload')}
        >
          {t('admin.photos.tabUpload', '업로드')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'organize'}
          className={`photo-inbox-tab ${tab === 'organize' ? 'is-active' : ''}`}
          onClick={() => setTab('organize')}
        >
          {t('admin.photos.tabOrganize', '사진 정리')}
        </button>
      </div>

      <div hidden={tab !== 'upload'}>
        <PhotoUploadPanel onUploaded={handleUploaded} />
      </div>

      <div hidden={tab !== 'organize'}>
        <PhotoOrganizeBoard
          initialPhotos={initialPhotos}
          initialTotal={initialTotal}
          pageSize={pageSize}
          reloadSignal={reloadSignal}
        />
      </div>
    </div>
  );
}
