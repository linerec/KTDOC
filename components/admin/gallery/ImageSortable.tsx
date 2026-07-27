'use client';

/**
 * ImageSortable Component
 * 이미지 정렬 및 삭제 관리
 */

import { useRef, useState } from 'react';
import Image from 'next/image';
import type { EventImage } from '@/types/gallery';

interface ImageSortableProps {
  eventId: number;
  images: EventImage[];
  onReorder: (images: EventImage[]) => void;
  onDelete: (imageId: number) => void;
}

export default function ImageSortable({
  eventId,
  images,
  onReorder,
  onDelete,
}: ImageSortableProps) {
  const [deleting, setDeleting] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [coverSaving, setCoverSaving] = useState<number | null>(null);
  // 순서 저장이 실패했을 때 되돌릴 기준(드래그 시작·대표 지정 직전의 순서)
  const orderBeforeRef = useRef<EventImage[]>(images);

  /**
   * 새 순서를 서버에 저장한다. 실패하면 화면을 이전 순서로 되돌려
   * 보이는 순서와 실제 저장된 순서가 어긋나지 않게 한다.
   */
  const persistOrder = async (next: EventImage[], previous: EventImage[]) => {
    setSaving(true);
    setOrderError(null);
    try {
      const res = await fetch(
        `/api/admin/gallery/events/${eventId}/images/order`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageIds: next.map((img) => img.id) }),
        }
      );

      const data = await res.json().catch(() => null);
      if (!data?.success) {
        throw new Error(data?.error || '순서 저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to save order:', err);
      onReorder(previous);
      setOrderError('순서 저장에 실패했습니다. 화면을 이전 순서로 되돌렸습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (imageId: number) => {
    if (!confirm('이 이미지를 삭제하시겠습니까?')) return;

    setDeleting(imageId);
    try {
      const res = await fetch(
        `/api/admin/gallery/events/${eventId}/images?imageId=${imageId}`,
        { method: 'DELETE' }
      );

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || '삭제에 실패했습니다.');
      }

      onDelete(imageId);
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeleting(null);
    }
  };

  const handleDragStart = (index: number) => {
    orderBeforeRef.current = images;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);

    setDraggedIndex(index);
    onReorder(newImages);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;
    setDraggedIndex(null);

    await persistOrder(images, orderBeforeRef.current);
  };

  /**
   * 이 사진을 맨 앞으로 — 목록·홈 카드에 쓰이는 대표 사진은 첫 번째 사진이다.
   * 드래그 없이 한 번에 대표를 바꿀 수 있게 한다(터치 기기 포함).
   */
  const handleSetCover = async (index: number) => {
    if (index === 0 || saving) return;

    const previous = images;
    const next = [...images];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);

    onReorder(next);
    setCoverSaving(picked.id);
    await persistOrder(next, previous);
    setCoverSaving(null);
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="admin-image-sortable">
      <div className="admin-image-sortable-header">
        <span>
          {images.length}개의 이미지 {saving && '(저장 중...)'}
        </span>
        <span className="admin-hint">드래그하여 순서 변경</span>
      </div>

      <p className="admin-image-sortable-note">
        맨 앞 사진이 <strong>대표 사진</strong>입니다 — 공연 목록과 홈 카드에 이 사진이 쓰입니다.
      </p>

      {orderError && (
        <div className="admin-alert admin-alert-error admin-alert-sm" role="alert">
          {orderError}
        </div>
      )}

      <div className="admin-image-grid">
        {images.map((image, index) => {
          const isCover = index === 0;

          return (
            <div
              key={image.id}
              className={`admin-image-item ${
                isCover ? 'admin-image-item-cover' : ''
              } ${draggedIndex === index ? 'admin-image-item-dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div className="admin-image-item-preview">
                <Image
                  src={image.image_url}
                  alt={image.caption_ko || `Image ${index + 1}`}
                  fill
                  sizes="150px"
                  className="admin-image-thumb"
                />
                <div className="admin-image-item-overlay">
                  <span className="admin-image-item-index">{index + 1}</span>
                  <button
                    type="button"
                    className="admin-image-item-delete"
                    onClick={() => handleDelete(image.id)}
                    disabled={deleting === image.id}
                  >
                    {deleting === image.id ? (
                      <span className="admin-spinner-sm" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {isCover ? (
                <span className="admin-image-cover-tag">대표 사진</span>
              ) : (
                <button
                  type="button"
                  className="admin-image-cover-btn"
                  onClick={() => handleSetCover(index)}
                  disabled={saving}
                  aria-label={`${index + 1}번째 사진을 대표 사진으로 지정`}
                >
                  {coverSaving === image.id ? '지정 중...' : '대표로 지정'}
                </button>
              )}

              {image.caption_ko && (
                <p className="admin-image-item-caption">{image.caption_ko}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
