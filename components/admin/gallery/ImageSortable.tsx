'use client';

/**
 * ImageSortable Component
 * 이미지 정렬 및 삭제 관리
 */

import { useState, useCallback } from 'react';
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

    // Save new order to server
    setSaving(true);
    try {
      const imageIds = images.map((img) => img.id);
      const res = await fetch(
        `/api/admin/gallery/events/${eventId}/images/order`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageIds }),
        }
      );

      const data = await res.json();
      if (!data.success) {
        console.error('Failed to save order:', data.error);
      }
    } catch (err) {
      console.error('Failed to save order:', err);
    } finally {
      setSaving(false);
    }
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

      <div className="admin-image-grid">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`admin-image-item ${
              draggedIndex === index ? 'admin-image-item-dragging' : ''
            }`}
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
            {image.caption_ko && (
              <p className="admin-image-item-caption">{image.caption_ko}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
