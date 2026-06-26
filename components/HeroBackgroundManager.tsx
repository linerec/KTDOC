'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ImageObject from '@/components/common/ImageObject';

export interface HeroSlide {
  keycode: string;
  fallbackSrc: string;
  position: string;
}

/**
 * Hero 배경 슬라이드 관리 모달.
 * 편집 모드일 때 히어로 영역에 떠 있는 진입 버튼을 노출하고, 클릭하면 별도의 모달에서
 * 배경 3장을 한곳에 모아 교체·관리한다. 상단 툴바·헤더와 UI가 겹치지 않게 한다.
 * 각 슬라이드는 ImageObject의 기존 편집 모달을 그대로 사용하며, 교체 결과는
 * 동일 keycode를 쓰는 실제 배경 슬라이드에도 즉시 반영된다.
 */
export default function HeroBackgroundManager({ slides }: { slides: HeroSlide[] }) {
  const [open, setOpen] = useState(false);

  // ESC로 모달 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="section-edit-btn section-edit-btn--hero"
        onClick={() => setOpen(true)}
        title="Hero 섹션 설정"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>Hero 섹션 설정</span>
      </button>

      {open && createPortal(
        <div className="hero-bg-manager-overlay" onClick={() => setOpen(false)}>
          <div className="hero-bg-manager-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hero-bg-manager-header">
              <div className="hero-bg-manager-title">
                <h3>Hero 배경 이미지</h3>
                <p>홈 화면 상단에 순환 노출되는 배경 사진 3장을 관리합니다.</p>
              </div>
              <button
                type="button"
                className="hero-bg-manager-close"
                onClick={() => setOpen(false)}
                aria-label="닫기"
              >
                &times;
              </button>
            </div>

            <div className="hero-bg-manager-grid">
              {slides.map((slide, index) => (
                <div className="hero-bg-manager-slide" key={slide.keycode}>
                  <div className="hero-bg-manager-thumb">
                    <ImageObject
                      keycode={slide.keycode}
                      fill
                      sizes="320px"
                      quality={70}
                      containerClassName="hero-bg-manager-fill"
                      fallbackSrc={slide.fallbackSrc}
                      imageStyle={{ objectFit: 'cover', objectPosition: slide.position }}
                    />
                  </div>
                  <span className="hero-bg-manager-caption">슬라이드 {index + 1}</span>
                </div>
              ))}
            </div>

            <p className="hero-bg-manager-hint">
              각 사진 위의 연필 아이콘을 눌러 이미지를 교체하거나 대체 텍스트를 수정할 수 있습니다.
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
