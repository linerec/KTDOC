'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { GalleryPhoto } from '@/types/gallery';
import EventPicker from './EventPicker';

export interface PhotoDraftInput {
  caption_ko: string;
  caption_en: string;
  taken_date: string | null;
  event_id: number | null;
  is_published: boolean;
  is_featured: boolean;
}

interface PhotoDetailDrawerProps {
  photo: GalleryPhoto;
  saving: boolean;
  deleting: boolean;
  onSave: (photoId: number, input: PhotoDraftInput) => void;
  onDelete: (photo: GalleryPhoto) => void;
  onClose: () => void;
  onOpenLightbox: () => void;
}

/** 사진이 속한 공연의 표시 라벨 ("{연도} · {제목}") */
function eventLabelOf(photo: GalleryPhoto): string | null {
  if (photo.event_id && photo.event_title_ko) {
    return `${photo.event_year ?? ''} · ${photo.event_title_ko}`.trim();
  }
  return null;
}

/**
 * 우측 슬라이드 드로어 — 사진 한 장의 상세(캡션 ko/en·촬영일·공연·공개/강조)를 편집한다.
 */
export default function PhotoDetailDrawer({
  photo,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
  onOpenLightbox,
}: PhotoDetailDrawerProps) {
  const [draft, setDraft] = useState<PhotoDraftInput>(() => toDraft(photo));
  const [eventLabel, setEventLabel] = useState<string | null>(() => eventLabelOf(photo));

  // 다른 사진을 열면 드래프트/라벨 초기화
  useEffect(() => {
    setDraft(toDraft(photo));
    setEventLabel(eventLabelOf(photo));
  }, [photo]);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const publicHref =
    photo.event_year && photo.event_slug
      ? `/gallery/${photo.event_year}/${photo.event_slug}`
      : '/gallery';

  return (
    <>
      <div className="photo-drawer-scrim" onClick={onClose} />
      <aside className="photo-drawer" role="dialog" aria-label="사진 상세 편집">
        <header className="photo-drawer-header">
          <h3>사진 정리</h3>
          <button type="button" className="photo-drawer-close" onClick={onClose} aria-label="닫기">
            &times;
          </button>
        </header>

        <div className="photo-drawer-body">
          <button
            type="button"
            className="photo-drawer-preview"
            onClick={onOpenLightbox}
            title="확대해서 보기"
          >
            <Image
              src={photo.image_url}
              alt={draft.caption_ko || 'Gallery photo'}
              fill
              sizes="380px"
              className="photo-drawer-preview-img"
            />
            <span className="photo-drawer-zoom">확대</span>
          </button>

          <div className="photo-drawer-fields">
            <label>
              한국어 설명
              <input
                type="text"
                value={draft.caption_ko}
                onChange={(e) => setDraft((d) => ({ ...d, caption_ko: e.target.value }))}
                placeholder="예: 부채춤 공연 리허설"
              />
            </label>

            <label>
              영문 설명 (English)
              <input
                type="text"
                value={draft.caption_en}
                onChange={(e) => setDraft((d) => ({ ...d, caption_en: e.target.value }))}
                placeholder="e.g. Fan dance rehearsal"
              />
            </label>

            <label>
              촬영일
              <input
                type="date"
                value={draft.taken_date ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, taken_date: e.target.value || null }))}
              />
            </label>

            <label>
              속한 공연
              <EventPicker
                value={draft.event_id}
                valueLabel={eventLabel}
                placeholder="아직 모름"
                allowClear
                clearLabel="아직 모름 (공연에서 빼기)"
                buttonClassName="photo-drawer-event-picker"
                onChange={(id, ev) => {
                  setDraft((d) => ({ ...d, event_id: id }));
                  setEventLabel(ev ? `${ev.year} · ${ev.title_ko}` : null);
                }}
              />
            </label>

            <div className="photo-drawer-toggles">
              <label className="admin-form-checkbox">
                <input
                  type="checkbox"
                  checked={draft.is_published}
                  onChange={(e) => setDraft((d) => ({ ...d, is_published: e.target.checked }))}
                />
                <span>공개</span>
              </label>
              <label className="admin-form-checkbox">
                <input
                  type="checkbox"
                  checked={draft.is_featured}
                  onChange={(e) => setDraft((d) => ({ ...d, is_featured: e.target.checked }))}
                />
                <span>강조</span>
              </label>
            </div>

            <p className="photo-drawer-meta">
              {photo.event_image_id
                ? '공연에 들어있음'
                : photo.event_id
                  ? '공연 연결 대기 — 정리 저장을 누르면 공연 사진으로 게시됩니다'
                  : '미분류'}
            </p>
            {photo.uploaded_by && (
              <p className="photo-drawer-meta photo-drawer-meta-submitted">
                학생 제출{photo.uploader_name ? ` · ${photo.uploader_name}` : ''}
              </p>
            )}
          </div>
        </div>

        <footer className="photo-drawer-footer">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => onSave(photo.id, draft)}
            disabled={saving}
          >
            {saving ? '저장 중...' : '정리 저장'}
          </button>
          <Link href={publicHref} className="admin-btn admin-btn-outline" target="_blank">
            공개 화면
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={() => onDelete(photo)}
            disabled={deleting}
          >
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        </footer>
      </aside>
    </>
  );
}

function toDraft(photo: GalleryPhoto): PhotoDraftInput {
  return {
    caption_ko: photo.caption_ko || '',
    caption_en: photo.caption_en || '',
    taken_date: photo.taken_date || null,
    event_id: photo.event_id ?? null,
    is_published: photo.is_published === 1,
    is_featured: photo.is_featured === 1,
  };
}
