'use client';

/**
 * 대표 이미지 + 공개 여부
 *
 * 올리면 즉시 R2에 저장되고 폼에는 주소만 남는다(저장 전에도 파일은 이미 올라가 있다).
 * '이미지 제거'는 주소만 지운다 — 저장해야 실제로 떨어진다.
 */

import type { ChangeEvent, RefObject } from 'react';
import Image from 'next/image';
import { useT } from '@/lib/i18n/useT';
import type { NewsFormData } from './PostFields';

interface ThumbnailFieldProps {
  formData: NewsFormData;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSelectFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export default function ThumbnailField({
  formData,
  onChange,
  onSelectFile,
  onClear,
  uploading,
  fileInputRef,
}: ThumbnailFieldProps) {
  const t = useT();

  return (
    <div className="admin-form-section">
      <h3 className="admin-form-section-title">{t('admin.news.secThumb', '대표 이미지')}</h3>
      <p className="admin-form-help">
        {t(
          'admin.news.secThumbHelp',
          '카드와 상세 화면 상단에 표시됩니다. 4MB 이하의 JPEG·PNG·WebP·GIF 파일을 올릴 수 있습니다.'
        )}
      </p>

      {formData.thumbnail_url ? (
        <div className="admin-news-thumb-preview">
          <Image
            src={formData.thumbnail_url}
            alt={t('admin.news.thumbAlt', '대표 이미지 미리보기')}
            width={320}
            height={200}
            className="admin-news-thumb-img"
          />
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-outline"
            onClick={onClear}
          >
            {t('admin.aiFill.removeImage', '이미지 제거')}
          </button>
        </div>
      ) : (
        <div className="admin-form-group">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onSelectFile}
            disabled={uploading}
            className="admin-form-input"
          />
          {uploading && (
            <p className="admin-form-help">{t('admin.photos.uploadingShort', '업로드 중...')}</p>
          )}
        </div>
      )}

      <div className="admin-form-checkbox" style={{ marginTop: 20 }}>
        <input
          type="checkbox"
          id="is_published"
          name="is_published"
          checked={formData.is_published}
          onChange={onChange}
        />
        <label htmlFor="is_published">
          {t('admin.news.publishLabel', '공개 미디어 페이지에 표시')}
        </label>
      </div>
    </div>
  );
}
