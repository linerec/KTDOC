'use client';

/**
 * ProgramImageUploader
 * 프로그램 묶음 사진 업로더 (드래그앤드롭). gallery ImageUploader의 프로그램 전용 포크.
 */

import { useState, useCallback, useRef } from 'react';
import type { ProgramImage } from '@/types/programs';
import { pickImageFiles, uploadImageFiles, MAX_UPLOAD_FILE_MB } from '@/lib/uploadClient';

interface ProgramImageUploaderProps {
  programId: number;
  onUploadComplete: (images: ProgramImage[]) => void;
}

export default function ProgramImageUploader({
  programId,
  onUploadComplete,
}: ProgramImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setError(null);
      setUploading(true);
      setProgress(0);

      try {
        const validFiles = pickImageFiles(files);
        if (validFiles.length === 0) {
          throw new Error('이미지 파일만 업로드할 수 있습니다.');
        }

        const results = await uploadImageFiles<{
          success: boolean;
          data: { images: ProgramImage[] };
        }>(`/api/admin/programs/${programId}/images`, validFiles, {
          onProgress: (done, total) => setProgress(Math.round((done / total) * 100)),
        });

        setProgress(100);
        onUploadComplete(results.flatMap((r) => r.data.images));
      } catch (err) {
        setError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
      } finally {
        setUploading(false);
        setProgress(0);
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }
    },
    [programId, onUploadComplete]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className="admin-image-uploader">
      <div
        className={`admin-dropzone ${dragActive ? 'admin-dropzone-active' : ''} ${
          uploading ? 'admin-dropzone-uploading' : ''
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFilePicker}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleChange}
          className="admin-dropzone-input"
        />

        {uploading ? (
          <div className="admin-dropzone-progress">
            <div className="admin-progress-bar">
              <div className="admin-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="admin-progress-text">업로드 중... {progress}%</span>
          </div>
        ) : (
          <div className="admin-dropzone-content">
            <svg
              className="admin-dropzone-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 16V4m0 0l4 4m-4-4l-4 4" />
              <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <p className="admin-dropzone-text">이미지를 드래그하거나 클릭하여 업로드</p>
            <p className="admin-dropzone-hint">
              여러 이미지를 한 번에 업로드할 수 있습니다 · 장당 최대 {MAX_UPLOAD_FILE_MB}MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="admin-alert admin-alert-error admin-alert-sm">{error}</div>
      )}
    </div>
  );
}
