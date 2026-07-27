'use client';

/**
 * InstagramStripEditor — 인스타 하이라이트 편집 모달 (admin 편집 모드 전용)
 *
 * 홈 섹션 설정의 기존 패턴을 따른다(HeaderBackgroundEditor·HeroBackgroundManager):
 * 섹션 좌하단 .section-edit-btn → 포털 모달 → 저장 시 /api/admin/settings.
 *
 * 사진은 반드시 R2에 업로드한다 — 인스타 CDN URL은 서명이 붙어 있어 핫링크하면
 * 며칠 뒤 깨진다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  INSTAGRAM_MAX_ITEMS,
  INSTAGRAM_VISIBLE_COUNT,
  SETTING_SOCIAL_INSTAGRAM,
  isValidInstagramUrl,
  serializeInstagramHighlights,
  type InstagramHighlight,
} from '@/lib/socialHighlights';

export default function InstagramStripEditor({
  initialItems,
}: {
  initialItems: InstagramHighlight[];
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<InstagramHighlight[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const handleOpen = () => {
    setItems(initialItems);
    setError('');
    setOpen(true);
  };

  const handleCancel = useCallback(() => {
    setOpen(false);
    setError('');
  }, []);

  /** 사진을 먼저 올리고, 빈 URL 항목으로 목록에 추가한다(URL은 아래 입력칸에서 채운다) */
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (items.length >= INSTAGRAM_MAX_ITEMS) {
      setError(`최대 ${INSTAGRAM_MAX_ITEMS}장까지 등록할 수 있습니다.`);
      return;
    }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', files[0]);
      form.append('folder', 'social');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '업로드에 실패했습니다.');
      }
      setItems((prev) => [
        ...prev,
        { url: '', imageUrl: data.data.url, imageR2Key: data.data.key, alt: '' },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const patch = (index: number, next: Partial<InstagramHighlight>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...next } : it)));
  };

  const remove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const to = index + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    // 사진만 올리고 링크를 비워두면 저장 시 사라진다 — 미리 막는다
    const missing = items.findIndex((i) => !i.url || !isValidInstagramUrl(i.url));
    if (missing !== -1) {
      setError(`${missing + 1}번 항목의 게시물 링크를 확인해 주세요 (instagram.com 주소).`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: SETTING_SOCIAL_INSTAGRAM,
          value: serializeInstagramHighlights(items),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '저장에 실패했습니다.');
      }
      setOpen(false);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="section-edit-btn section-edit-btn--insta"
        onClick={handleOpen}
        title="인스타그램 하이라이트 설정"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" />
        </svg>
        <span>인스타그램 설정</span>
      </button>

      {open && mounted && createPortal(
        <div className="image-object-modal-overlay" onClick={handleCancel}>
          <div className="image-object-modal insta-modal" onClick={(e) => e.stopPropagation()}>
            <div className="intl-modal-header">
              <h3>인스타그램 하이라이트</h3>
              <button className="intl-modal-close" onClick={handleCancel} aria-label="닫기">
                ×
              </button>
            </div>

            <div className="intl-modal-body">
              <p className="admin-form-help">
                사진을 올리고 해당 게시물 링크를 넣으세요. 앞에서부터{' '}
                {INSTAGRAM_VISIBLE_COUNT}장이 홈에 표시됩니다(최대 {INSTAGRAM_MAX_ITEMS}장 등록).
                캡션은 표시하지 않습니다.
              </p>

              {items.length === 0 && (
                <p className="insta-modal-empty">아직 등록된 게시물이 없습니다.</p>
              )}

              <ul className="insta-modal-list">
                {items.map((item, i) => (
                  <li
                    key={item.imageR2Key || `${item.imageUrl}-${i}`}
                    className={`insta-modal-row${i < INSTAGRAM_VISIBLE_COUNT ? ' is-visible' : ''}`}
                  >
                    <div className="insta-modal-thumb">
                      <Image src={item.imageUrl} alt="" fill sizes="72px" />
                    </div>

                    <div className="insta-modal-fields">
                      <label className="admin-form-label" htmlFor={`insta-url-${i}`}>
                        게시물 링크 <span className="required">*</span>
                      </label>
                      <input
                        id={`insta-url-${i}`}
                        type="url"
                        className="admin-form-input"
                        placeholder="https://www.instagram.com/p/..."
                        value={item.url}
                        onChange={(e) => patch(i, { url: e.target.value })}
                      />
                      <label className="admin-form-label" htmlFor={`insta-alt-${i}`}>
                        대체 텍스트 (선택 · 화면에는 안 보임)
                      </label>
                      <input
                        id={`insta-alt-${i}`}
                        type="text"
                        className="admin-form-input"
                        placeholder="예: 수료식 단체사진"
                        value={item.alt}
                        onChange={(e) => patch(i, { alt: e.target.value })}
                      />
                    </div>

                    <div className="insta-modal-actions">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="위로">
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === items.length - 1}
                        title="아래로"
                      >
                        ↓
                      </button>
                      <button type="button" onClick={() => remove(i)} title="삭제">
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="insta-modal-add">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleUpload(e.target.files)}
                  disabled={uploading || items.length >= INSTAGRAM_MAX_ITEMS}
                />
                {uploading && <span className="insta-modal-hint">업로드 중...</span>}
              </div>

              {error && <div className="admin-inline-error">{error}</div>}
            </div>

            <div className="intl-modal-footer">
              <button className="intl-btn-cancel" onClick={handleCancel} disabled={saving}>
                취소
              </button>
              <button className="intl-btn-save" onClick={handleSave} disabled={saving || uploading}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
