'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBuilder } from '@/contexts/BuilderContext';
import { isAdmin } from '@/lib/isAdmin';
import { uploadImageFile } from '@/lib/uploadClient';

/**
 * 같은 keycode를 쓰는 ImageObject 인스턴스들끼리 갱신을 동기화하기 위한 이벤트.
 * 예) Hero 배경 관리 모달에서 사진을 교체하면, 실제 배경 슬라이드도 즉시 새 이미지로 갱신된다.
 */
const IMAGE_OBJECT_REFRESH_EVENT = 'imageobject:refresh';

interface ImageData {
  url: string;
  r2_key: string;
  alt_ko: string | null;
  alt_en: string | null;
  width: number | null;
  height: number | null;
}

interface ImageObjectProps {
  keycode: string;
  alt?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  className?: string;
  containerClassName?: string;
  /**
   * D1에 등록된 이미지가 없을 때 그릴 번들 이미지 — **현재 쓰는 사진일 때만** 둔다.
   * 콘솔에서 새 사진으로 교체된 자리에 옛 파일을 남겨 두면, 이미지 서버가 잠깐
   * 흔들릴 때 지난 사진이 대신 올라온다. 그런 자리에는 `null` 을 줘서
   * 아무것도 그리지 않고 자리만 비운다(빈 편이 틀린 것보다 안전하다).
   */
  fallbackSrc?: string | null;
  isLogin?: boolean;
  sizes?: string;
  quality?: number;
  children?: React.ReactNode;
  overlay?: boolean;
  imageStyle?: React.CSSProperties;
  /** true면 편집 모드여도 인라인 편집 어포던스(연필 버튼·키코드 라벨·편집 모달)를 숨긴다.
   *  순수하게 이미지를 표시하는 용도(예: Hero 배경 슬라이드)로 쓸 때 사용. */
  disableInlineEdit?: boolean;
}

export default function ImageObject({
  keycode,
  alt,
  width = 400,
  height = 300,
  fill = false,
  priority = false,
  className = '',
  containerClassName = '',
  fallbackSrc = '/assets/images/placeholder.png',
  isLogin,
  sizes,
  quality = 75,
  children,
  overlay = false,
  imageStyle,
  disableInlineEdit = false,
}: ImageObjectProps) {
  const { data: session } = useSession();
  const { locale } = useLanguage();
  const { isEditMode } = useBuilder();

  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editAltKo, setEditAltKo] = useState('');
  const [editAltEn, setEditAltEn] = useState('');
  const [mounted, setMounted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const canEdit = isLogin !== undefined ? isLogin : isAdmin(session);
  const isEditable = canEdit && isEditMode && !disableInlineEdit;

  // 이미지 데이터 로드
  const loadImage = useCallback(async () => {
    try {
      const res = await fetch(`/api/images?keycode=${encodeURIComponent(keycode)}`);
      const data = await res.json();
      if (data.success && data.data) {
        setImageData(data.data);
        setEditAltKo(data.data.alt_ko || '');
        setEditAltEn(data.data.alt_en || '');
      }
    } catch (error) {
      console.error('Failed to fetch image:', error);
    } finally {
      setIsLoading(false);
    }
  }, [keycode]);

  useEffect(() => {
    loadImage();
  }, [loadImage]);

  // 같은 keycode를 쓰는 다른 인스턴스가 이미지를 갱신하면 함께 다시 불러온다.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ keycode: string }>).detail;
      if (detail?.keycode === keycode) {
        loadImage();
      }
    };
    window.addEventListener(IMAGE_OBJECT_REFRESH_EVENT, handler);
    return () => window.removeEventListener(IMAGE_OBJECT_REFRESH_EVENT, handler);
  }, [keycode, loadImage]);

  const notifyUpdated = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(IMAGE_OBJECT_REFRESH_EVENT, { detail: { keycode } })
    );
  }, [keycode]);

  // 이미지 소스 결정
  const hasValidImage = imageData?.url && imageData.url !== '/assets/images/placeholder.png' && imageData.r2_key;
  const imageSrc = hasValidImage ? imageData.url : fallbackSrc;
  // 등록된 이미지도 없고 폴백도 없으면 그릴 것이 없다. 자리만 남기고 비운다.
  const isBlank = !imageSrc;
  const imageAlt = alt || (locale === 'ko' ? imageData?.alt_ko : imageData?.alt_en) || keycode;

  // 편집 클릭 핸들러
  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditable) {
      setShowModal(true);
    }
  };

  // 파일 업로드 핸들러
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // 1. R2에 업로드
      const uploadData = await uploadImageFile<{
        success: boolean;
        data: { url: string; key: string; size: number; contentType: string };
      }>('/api/upload', file, { fields: { folder: 'images' } });

      // 2. 이미지 크기 가져오기
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // 3. DB에 메타데이터 저장
      const saveRes = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keycode,
          url: uploadData.data.url,
          r2_key: uploadData.data.key,
          alt_ko: editAltKo,
          alt_en: editAltEn,
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: uploadData.data.size,
          content_type: uploadData.data.contentType,
        }),
      });

      if (saveRes.ok) {
        setImageData({
          url: uploadData.data.url,
          r2_key: uploadData.data.key,
          alt_ko: editAltKo,
          alt_en: editAltEn,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        setShowModal(false);
        notifyUpdated();
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Alt 텍스트만 저장
  const handleSaveAlt = async () => {
    if (!imageData) return;

    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keycode,
          url: imageData.url,
          r2_key: imageData.r2_key,
          alt_ko: editAltKo,
          alt_en: editAltEn,
          width: imageData.width,
          height: imageData.height,
        }),
      });

      if (res.ok) {
        setImageData({
          ...imageData,
          alt_ko: editAltKo,
          alt_en: editAltEn,
        });
        setShowModal(false);
        notifyUpdated();
      }
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div
        className={`image-object-loading ${containerClassName}`}
        style={{ width: fill ? '100%' : width, height: fill ? '100%' : height }}
      />
    );
  }

  return (
    <>
      <div
        className={`image-object-container ${containerClassName} ${isEditable ? 'editable' : ''}`}
        style={fill ? { width: '100%', height: '100%' } : undefined}
      >
        {isBlank ? (
          /* 빈 자리 — 운영자에게는 편집 버튼이 보이므로 여기서 바로 사진을 올릴 수 있다 */
          <div
            className={`image-object-blank ${className}`.trim()}
            style={fill ? undefined : { width: '100%', aspectRatio: `${width} / ${height}` }}
            aria-hidden="true"
          />
        ) : fill ? (
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            sizes={sizes || '100vw'}
            priority={priority}
            quality={quality}
            className={className}
            style={{ objectFit: 'cover', ...imageStyle }}
          />
        ) : (
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={imageData?.width || width}
            height={imageData?.height || height}
            priority={priority}
            quality={quality}
            className={className}
            style={imageStyle}
          />
        )}

        {/* Overlay for children content */}
        {overlay && children && (
          <div className="image-object-content-overlay">
            {children}
          </div>
        )}

        {/* Non-overlay children */}
        {!overlay && children}

        {/* Keycode label */}
        {isEditable && (
          <span className="keycode-label keycode-label--image">{keycode}</span>
        )}

        {/* Edit button */}
        {isEditable && (
          <button className="image-object-edit-btn" onClick={handleEditClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      {/* 편집 모달 - Portal로 렌더링하여 HTML 중첩 문제 방지 */}
      {showModal && mounted && createPortal(
        <div className="image-object-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="image-object-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-object-modal-header">
              <h3>이미지 편집</h3>
              <button onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <div className="image-object-modal-body">
              <div className="image-object-preview">
                {imageSrc && imageSrc !== '/assets/images/placeholder.png' ? (
                  <Image
                    src={imageSrc}
                    alt="Preview"
                    width={imageData?.width || 640}
                    height={imageData?.height || 360}
                    className="image-object-preview-img"
                  />
                ) : (
                  <div className="image-object-no-image">이미지 없음</div>
                )}
              </div>

              <div className="image-object-form">
                <div className="form-group">
                  <label>키코드</label>
                  <input type="text" value={keycode} disabled />
                </div>

                <div className="form-group">
                  <label>이미지 업로드</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </div>

                <div className="form-group">
                  <label>대체 텍스트 (한국어)</label>
                  <input
                    type="text"
                    value={editAltKo}
                    onChange={(e) => setEditAltKo(e.target.value)}
                    placeholder="이미지 설명 (한국어)"
                  />
                </div>

                <div className="form-group">
                  <label>대체 텍스트 (English)</label>
                  <input
                    type="text"
                    value={editAltEn}
                    onChange={(e) => setEditAltEn(e.target.value)}
                    placeholder="Image description (English)"
                  />
                </div>
              </div>
            </div>

            <div className="image-object-modal-footer">
              <button onClick={() => setShowModal(false)}>취소</button>
              <button onClick={handleSaveAlt} disabled={!imageData || uploading}>
                저장
              </button>
            </div>

            {uploading && (
              <div className="image-object-uploading">
                <span>업로드 중...</span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
