'use client';

import { useCallback, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import {
  pickImageFiles,
  uploadImageFiles,
  MAX_UPLOAD_FILE_MB,
  type UploadResponse,
} from '@/lib/uploadClient';

interface PhotoUploadPanelProps {
  /** 업로드 성공 시 정리 보드를 새로고침하기 위한 콜백 */
  onUploaded: () => void;
}

/**
 * 사진 업로드 탭.
 * 드래그앤드롭 / 클릭으로 다중 이미지를 보관함에 올린다.
 * publishNow 체크 시 공개 Gallery 사진 스트림에 즉시 노출된다.
 */
export default function PhotoUploadPanel({ onUploaded }: PhotoUploadPanelProps) {
  const t = useT();
  const [uploading, setUploading] = useState(false);
  const [publishNow, setPublishNow] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setError(null);
      setLastCount(null);
      setUploading(true);

      try {
        const validFiles = pickImageFiles(files);
        if (validFiles.length === 0) {
          setError(t('admin.common.imageOnly', '이미지 파일만 업로드할 수 있습니다.'));
          return;
        }

        const results = await uploadImageFiles<UploadResponse<{ count?: number }>>(
          '/api/admin/gallery/photos',
          validFiles,
          {
            fields: { publishNow: publishNow ? 'true' : 'false' },
            failMessage: t('admin.photos.uploadFailed', '사진 업로드에 실패했습니다.'),
          }
        );

        const uploaded = results.reduce((sum, r) => sum + (r.data?.count ?? 0), 0);
        setLastCount(uploaded > 0 ? uploaded : validFiles.length);
        onUploaded();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('admin.photos.uploadFailed', '사진 업로드에 실패했습니다.')
        );
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [publishNow, onUploaded, t]
  );

  const handleDrag = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === 'dragenter' || event.type === 'dragover');
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <section className="photo-upload-panel admin-card">
      <div className="photo-upload-copy">
        <h2 className="admin-panel-title">{t('admin.photoSubmit.button', '사진 올리기')}</h2>
        <p>
          {t(
            'admin.photos.uploadHelp',
            '공연명이나 날짜를 아직 몰라도 사진을 먼저 올릴 수 있습니다. 여러 장을 한 번에 올린 뒤 ‘사진 정리’ 탭에서 촬영일과 소속 공연을 지정합니다.'
          )}
        </p>
      </div>

      <label className="admin-form-checkbox photo-upload-publish">
        <input
          type="checkbox"
          checked={publishNow}
          onChange={(event) => setPublishNow(event.target.checked)}
        />
        <span>{t('admin.photos.publishNow', '업로드 즉시 공개 Gallery에 표시')}</span>
      </label>

      <div
        className={`admin-dropzone photo-upload-dropzone ${dragActive ? 'admin-dropzone-active' : ''} ${
          uploading ? 'admin-dropzone-uploading' : ''
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="admin-dropzone-input"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <div className="admin-dropzone-content">
          <svg className="admin-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 16V4m0 0l4 4m-4-4l-4 4" />
            <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
          </svg>
          <p className="admin-dropzone-text">
            {uploading
              ? t('admin.photos.uploadingShort', '업로드 중...')
              : t('admin.photos.dropzone', '사진을 드래그하거나 클릭하여 업로드')}
          </p>
          <p className="admin-dropzone-hint">
            {t(
              'admin.photos.dropzoneHint',
              'JPG·PNG 등 이미지 파일을 여러 장 한 번에 올릴 수 있습니다. 장당 최대 {mb}MB.',
              { mb: MAX_UPLOAD_FILE_MB }
            )}
          </p>
        </div>
      </div>

      {error && <div className="admin-alert admin-alert-error photo-upload-msg">{error}</div>}
      {lastCount !== null && !error && (
        <div className="admin-alert admin-alert-success photo-upload-msg">
          {t('admin.photos.uploadDone', '{n}장을 올렸습니다. ‘사진 정리’ 탭에서 확인하세요.', {
            n: lastCount,
          })}
        </div>
      )}
    </section>
  );
}
