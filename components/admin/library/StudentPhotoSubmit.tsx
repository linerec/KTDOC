'use client';

import { useCallback, useRef, useState } from 'react';
import type { GalleryPhoto } from '@/types/gallery';
import Pagination from '@/components/common/Pagination';
import {
  pickImageFiles,
  uploadImageFiles,
  MAX_UPLOAD_FILE_MB,
  type UploadResponse,
} from '@/lib/uploadClient';

interface StudentPhotoSubmitProps {
  initialPhotos: GalleryPhoto[];
  initialTotal: number;
  pageSize: number;
}

type PhotoStatus = { label: string; tone: 'pending' | 'published' | 'linked' };

/** 학생 본인 사진 한 장의 상태 라벨(검토 중 / 게시됨 / 이벤트 수록) */
function statusOf(photo: GalleryPhoto): PhotoStatus {
  if (photo.is_published === 1) return { label: '게시됨', tone: 'published' };
  if (photo.event_id) return { label: '이벤트 수록', tone: 'linked' };
  return { label: '검토 중', tone: 'pending' };
}

/** 검토 전(비공개·미분류)에만 본인이 취소(삭제)할 수 있다 */
function canCancel(photo: GalleryPhoto): boolean {
  return photo.is_published === 0 && !photo.event_id;
}

/**
 * 내 사진 · 제출 — 학생·학부모가 본인 사진을 올리고 검토 상태를 확인한다.
 * 제출 사진은 비공개로 보관함에 들어가며 운영진 검토 후 공개된다.
 */
export default function StudentPhotoSubmit({
  initialPhotos,
  initialTotal,
  pageSize,
}: StudentPhotoSubmitProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadPage = useCallback(
    async (targetPage: number) => {
      setLoadingPage(true);
      setError(null);
      try {
        const res = await fetch(`/api/library/photos?page=${targetPage}&limit=${pageSize}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || '내 사진을 불러오지 못했습니다.');
        setPhotos(data.data.photos);
        setTotal(data.data.total);
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : '내 사진을 불러오지 못했습니다.');
      } finally {
        setLoadingPage(false);
      }
    },
    [pageSize]
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      setNotice(null);

      const validFiles = pickImageFiles(files);
      if (validFiles.length === 0) {
        setError('이미지 파일만 올릴 수 있습니다.');
        return;
      }

      setUploading(true);
      try {
        const results = await uploadImageFiles<UploadResponse<{ count?: number }>>(
          '/api/library/photos',
          validFiles,
          { failMessage: '사진 제출에 실패했습니다.' }
        );
        const submitted = results.reduce((sum, r) => sum + (r.data?.count ?? 0), 0);
        setNotice(`${submitted > 0 ? submitted : validFiles.length}장을 제출했습니다. 운영진 검토 후 공개됩니다.`);
        await loadPage(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : '사진 제출에 실패했습니다.');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [loadPage]
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

  const cancelPhoto = async (photo: GalleryPhoto) => {
    if (!confirm('이 사진 제출을 취소하시겠습니까? 올린 사진이 삭제됩니다.')) return;
    setDeletingId(photo.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/library/photos/${photo.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '사진 취소에 실패했습니다.');
      const remaining = photos.filter((p) => p.id !== photo.id);
      setTotal((c) => Math.max(0, c - 1));
      if (remaining.length === 0 && page > 1) {
        await loadPage(page - 1);
      } else {
        setPhotos(remaining);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진 취소에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="libmy">
      {/* 업로드 */}
      <section className="admin-card libmy-upload">
        <div className="libmy-upload-copy">
          <h2 className="admin-panel-title">사진 올리기</h2>
          <p>
            공연·연습 사진을 올리면 운영진이 확인한 뒤 공개 갤러리에 반영합니다. 올린 직후에는
            &lsquo;검토 중&rsquo; 상태이며, 검토 전에는 직접 취소할 수 있습니다.
          </p>
        </div>

        <div
          className={`admin-dropzone ${dragActive ? 'admin-dropzone-active' : ''} ${uploading ? 'admin-dropzone-uploading' : ''}`}
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
              {uploading ? '제출 중...' : '사진을 드래그하거나 클릭하여 올리기'}
            </p>
            <p className="admin-dropzone-hint">
              JPG·PNG 등 이미지 파일을 한 번에 여러 장 올릴 수 있습니다. 장당 최대 {MAX_UPLOAD_FILE_MB}MB.
            </p>
          </div>
        </div>

        {error && <div className="admin-alert admin-alert-error libmy-msg">{error}</div>}
        {notice && !error && <div className="admin-alert admin-alert-success libmy-msg">{notice}</div>}
      </section>

      {/* 내 사진 목록 */}
      <section className="libmy-list">
        <div className="libmy-list-head">
          <h2 className="admin-panel-title">내가 올린 사진</h2>
          <span className="libmy-count">{total > 0 ? `총 ${total}장` : '0장'}</span>
        </div>

        {photos.length === 0 ? (
          <div className="admin-empty-state">
            <p>아직 올린 사진이 없습니다. 위에서 사진을 올려 보세요.</p>
          </div>
        ) : (
          <div className={`libmy-grid ${loadingPage ? 'is-loading' : ''}`}>
            {photos.map((photo) => {
              const status = statusOf(photo);
              return (
                <article key={photo.id} className="libmy-tile">
                  <div className="libmy-tile-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.image_url} alt={photo.caption_ko || '제출한 사진'} loading="lazy" />
                    <span className={`libmy-status libmy-status-${status.tone}`}>{status.label}</span>
                  </div>
                  {canCancel(photo) && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-outline libmy-cancel"
                      onClick={() => cancelPhoto(photo)}
                      disabled={deletingId === photo.id}
                    >
                      {deletingId === photo.id ? '취소 중...' : '제출 취소'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={loadPage} disabled={loadingPage} />
      </section>
    </div>
  );
}
