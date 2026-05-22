'use client';

/**
 * EventForm Component
 * 이벤트 생성/편집 폼
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EventDetail, EventCategory, CreateEventInput, UpdateEventInput } from '@/types/gallery';
import ImageUploader from './ImageUploader';
import ImageSortable from './ImageSortable';
import VideoManager from './VideoManager';

interface EventFormProps {
  event?: EventDetail | null;
  categories: EventCategory[];
  isNew?: boolean;
}

export default function EventForm({
  event,
  categories,
  isNew = false,
}: EventFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title_ko: event?.title_ko || '',
    title_en: event?.title_en || '',
    event_date: event?.event_date?.split('T')[0] || '',
    category_id: event?.category_id || '',
    description_ko: event?.description_ko || '',
    description_en: event?.description_en || '',
    is_published: event?.is_published === 1,
    is_featured: event?.is_featured === 1,
  });

  // Images and videos (managed separately)
  const [images, setImages] = useState(event?.images || []);
  const [videos, setVideos] = useState(event?.videos || []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const url = isNew
        ? '/api/admin/gallery/events'
        : `/api/admin/gallery/events/${event?.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const body: CreateEventInput | UpdateEventInput = {
        title_ko: formData.title_ko,
        title_en: formData.title_en || undefined,
        event_date: formData.event_date,
        category_id: formData.category_id ? Number(formData.category_id) : undefined,
        description_ko: formData.description_ko || undefined,
        description_en: formData.description_en || undefined,
        is_published: formData.is_published,
        is_featured: formData.is_featured,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || '저장에 실패했습니다.');
      }

      // Redirect to event list or detail page
      if (isNew && data.data?.id) {
        router.push(`/admin/gallery/${data.data.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && (
        <div className="admin-alert admin-alert-error">
          {error}
        </div>
      )}

      <div className="admin-form-grid">
        {/* Basic Info Section */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">이벤트 기본 정보</h3>
          <p className="admin-form-help">
            이 정보가 공개 Gallery의 카드와 이벤트 상세 페이지에 표시됩니다.
          </p>

          <div className="admin-form-group">
            <label htmlFor="title_ko" className="admin-form-label">
              제목 (한글) <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title_ko"
              name="title_ko"
              value={formData.title_ko}
              onChange={handleChange}
              required
              className="admin-form-input"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="title_en" className="admin-form-label">
              제목 (영문)
            </label>
            <input
              type="text"
              id="title_en"
              name="title_en"
              value={formData.title_en}
              onChange={handleChange}
              className="admin-form-input"
            />
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="event_date" className="admin-form-label">
                행사 날짜 <span className="required">*</span>
              </label>
              <input
                type="date"
                id="event_date"
                name="event_date"
                value={formData.event_date}
                onChange={handleChange}
                required
                className="admin-form-input"
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="category_id" className="admin-form-label">
                카테고리
              </label>
              <select
                id="category_id"
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                className="admin-form-select"
              >
                <option value="">선택 안함</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name_ko}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="description_ko" className="admin-form-label">
              설명 (한글)
            </label>
            <textarea
              id="description_ko"
              name="description_ko"
              value={formData.description_ko}
              onChange={handleChange}
              rows={4}
              className="admin-form-textarea"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="description_en" className="admin-form-label">
              설명 (영문)
            </label>
            <textarea
              id="description_en"
              name="description_en"
              value={formData.description_en}
              onChange={handleChange}
              rows={4}
              className="admin-form-textarea"
            />
          </div>

          <div className="admin-form-row">
            <div className="admin-form-checkbox">
              <input
                type="checkbox"
                id="is_published"
                name="is_published"
                checked={formData.is_published}
                onChange={handleChange}
              />
              <label htmlFor="is_published">공개 Gallery에 표시</label>
            </div>

            <div className="admin-form-checkbox">
              <input
                type="checkbox"
                id="is_featured"
                name="is_featured"
                checked={formData.is_featured}
                onChange={handleChange}
              />
              <label htmlFor="is_featured">추천</label>
            </div>
          </div>
        </div>

        {/* Media Section - Only show for existing events */}
        {!isNew && event && (
          <>
            <div className="admin-form-section">
              <h3 className="admin-form-section-title">이 이벤트의 사진</h3>
              <p className="admin-form-help">
                업로드한 사진은 이 이벤트 상세 페이지의 사진 영역에 표시됩니다.
              </p>
              <ImageUploader
                eventId={event.id}
                onUploadComplete={(newImages) => {
                  setImages((prev) => [...prev, ...newImages]);
                }}
              />
              {images.length > 0 && (
                <ImageSortable
                  eventId={event.id}
                  images={images}
                  onReorder={setImages}
                  onDelete={(imageId) => {
                    setImages((prev) => prev.filter((img) => img.id !== imageId));
                  }}
                />
              )}
            </div>

            <div className="admin-form-section">
              <h3 className="admin-form-section-title">이 이벤트의 영상</h3>
              <p className="admin-form-help">
                YouTube 영상 링크를 추가하면 이 이벤트 상세 페이지의 영상 영역에 표시됩니다.
              </p>
              <VideoManager
                eventId={event.id}
                videos={videos}
                onAdd={(video) => setVideos((prev) => [...prev, video])}
                onDelete={(videoId) => {
                  setVideos((prev) => prev.filter((v) => v.id !== videoId));
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => router.back()}
          disabled={saving}
        >
          취소
        </button>
        <button
          type="submit"
          className="admin-btn admin-btn-primary"
          disabled={saving}
        >
          {saving ? '저장 중...' : isNew ? '생성' : '저장'}
        </button>
      </div>
    </form>
  );
}
