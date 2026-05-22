'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { EventWithCategory, GalleryPhoto } from '@/types/gallery';

interface PhotoInboxManagerProps {
  initialPhotos: GalleryPhoto[];
  events: EventWithCategory[];
}

interface DraftState {
  caption_ko: string;
  caption_en: string;
  taken_date: string;
  event_id: string;
  is_published: boolean;
  is_featured: boolean;
}

function toDraft(photo: GalleryPhoto): DraftState {
  return {
    caption_ko: photo.caption_ko || '',
    caption_en: photo.caption_en || '',
    taken_date: photo.taken_date || '',
    event_id: photo.event_id ? String(photo.event_id) : '',
    is_published: photo.is_published === 1,
    is_featured: photo.is_featured === 1,
  };
}

export default function PhotoInboxManager({
  initialPhotos,
  events,
}: PhotoInboxManagerProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [drafts, setDrafts] = useState<Record<number, DraftState>>(
    Object.fromEntries(initialPhotos.map((photo) => [photo.id, toDraft(photo)]))
  );
  const [uploading, setUploading] = useState(false);
  const [publishNow, setPublishNow] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateDraft = (photoId: number, next: Partial<DraftState>) => {
    setDrafts((current) => ({
      ...current,
      [photoId]: {
        ...current[photoId],
        ...next,
      },
    }));
  };

  const mergePhotos = (nextPhotos: GalleryPhoto[]) => {
    setPhotos((current) => [...nextPhotos, ...current]);
    setDrafts((current) => ({
      ...Object.fromEntries(nextPhotos.map((photo) => [photo.id, toDraft(photo)])),
      ...current,
    }));
  };

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setError(null);
      setUploading(true);

      try {
        const formData = new FormData();
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            formData.append('files', file);
          }
        }
        formData.append('publishNow', publishNow ? 'true' : 'false');

        const res = await fetch('/api/admin/gallery/photos', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || '사진 업로드에 실패했습니다.');
        }

        mergePhotos(data.data.photos);
      } catch (err) {
        setError(err instanceof Error ? err.message : '사진 업로드에 실패했습니다.');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [publishNow]
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

  const savePhoto = async (photoId: number) => {
    const draft = drafts[photoId];
    if (!draft) return;

    setSavingId(photoId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/gallery/photos/${photoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption_ko: draft.caption_ko,
          caption_en: draft.caption_en,
          taken_date: draft.taken_date || null,
          event_id: draft.event_id ? Number(draft.event_id) : null,
          is_published: draft.is_published,
          is_featured: draft.is_featured,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || '사진 정리에 실패했습니다.');
      }

      setPhotos((current) => current.map((photo) => (
        photo.id === photoId ? data.data : photo
      )));
      setDrafts((current) => ({
        ...current,
        [photoId]: toDraft(data.data),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진 정리에 실패했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  const deletePhoto = async (photo: GalleryPhoto) => {
    if (!confirm('이 사진을 보관함과 R2에서 삭제하시겠습니까?')) return;

    setDeletingId(photo.id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/gallery/photos/${photo.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || '사진 삭제에 실패했습니다.');
      }

      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setDrafts((current) => {
        const next = { ...current };
        delete next[photo.id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="photo-inbox">
      <section className="photo-inbox-upload admin-card">
        <div className="photo-inbox-upload-copy">
          <h2 className="admin-panel-title">사진 먼저 올리기</h2>
          <p>
            공연명이나 날짜를 아직 몰라도 사진을 먼저 올릴 수 있습니다.
            공개 상태로 올리면 방문자 Gallery의 사진 스트림에 바로 표시됩니다.
          </p>
        </div>

        <label className="admin-form-checkbox photo-inbox-publish">
          <input
            type="checkbox"
            checked={publishNow}
            onChange={(event) => setPublishNow(event.target.checked)}
          />
          <span>업로드 즉시 공개 Gallery에 표시</span>
        </label>

        <div
          className={`admin-dropzone ${dragActive ? 'admin-dropzone-active' : ''} ${
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
              {uploading ? '업로드 중...' : '사진을 드래그하거나 클릭하여 업로드'}
            </p>
            <p className="admin-dropzone-hint">여러 장을 한 번에 올린 뒤 하나씩 정리할 수 있습니다.</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="admin-alert admin-alert-error">
          {error}
        </div>
      )}

      <section className="photo-inbox-grid">
        {photos.length === 0 ? (
          <div className="admin-empty-state photo-inbox-empty">
            <p>아직 보관함에 올라온 사진이 없습니다.</p>
          </div>
        ) : photos.map((photo) => {
          const draft = drafts[photo.id] || toDraft(photo);
          const publicHref = photo.event_year && photo.event_slug
            ? `/gallery/${photo.event_year}/${photo.event_slug}`
            : '/gallery';

          return (
            <article className="photo-inbox-card" key={photo.id}>
              <div className="photo-inbox-image">
                <Image
                  src={photo.image_url}
                  alt={photo.caption_ko || 'Gallery photo'}
                  fill
                  sizes="(max-width: 768px) 100vw, 320px"
                  className="photo-inbox-img"
                />
                <span className={`photo-inbox-status ${draft.is_published ? 'is-public' : ''}`}>
                  {draft.is_published ? '공개 중' : '비공개'}
                </span>
              </div>

              <div className="photo-inbox-fields">
                <label>
                  한국어 설명
                  <input
                    type="text"
                    value={draft.caption_ko}
                    onChange={(event) => updateDraft(photo.id, { caption_ko: event.target.value })}
                    placeholder="예: 부채춤 공연 리허설"
                  />
                </label>

                <label>
                  촬영일
                  <input
                    type="date"
                    value={draft.taken_date}
                    onChange={(event) => updateDraft(photo.id, { taken_date: event.target.value })}
                  />
                </label>

                <label>
                  연결할 이벤트
                  <select
                    value={draft.event_id}
                    onChange={(event) => updateDraft(photo.id, { event_id: event.target.value })}
                  >
                    <option value="">아직 모름</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.year} · {event.title_ko}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="photo-inbox-toggles">
                  <label className="admin-form-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.is_published}
                      onChange={(event) => updateDraft(photo.id, { is_published: event.target.checked })}
                    />
                    <span>공개</span>
                  </label>
                  <label className="admin-form-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.is_featured}
                      onChange={(event) => updateDraft(photo.id, { is_featured: event.target.checked })}
                    />
                    <span>강조</span>
                  </label>
                </div>

                <div className="photo-inbox-meta">
                  {photo.event_image_id ? (
                    <span>이벤트 상세에 연결됨</span>
                  ) : (
                    <span>이벤트 미정리</span>
                  )}
                  {draft.taken_date ? null : <span>촬영일 미정</span>}
                </div>
              </div>

              <div className="photo-inbox-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  onClick={() => savePhoto(photo.id)}
                  disabled={savingId === photo.id}
                >
                  {savingId === photo.id ? '저장 중...' : '정리 저장'}
                </button>
                <Link href={publicHref} className="admin-btn admin-btn-outline admin-btn-sm" target="_blank">
                  공개 화면
                </Link>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger admin-btn-sm"
                  onClick={() => deletePhoto(photo)}
                  disabled={deletingId === photo.id}
                >
                  {deletingId === photo.id ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
