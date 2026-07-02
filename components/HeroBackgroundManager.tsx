'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import ImageObject from '@/components/common/ImageObject';
import {
  DEFAULT_HERO_OVERLAY,
  HERO_TINT_BLENDS,
  HERO_OVERLAY_CSS_VARS,
  serializeHeroOverlay,
  toHeroCssVars,
  type HeroOverlay,
  type HeroTintBlend,
} from '@/lib/heroBackground';

export interface HeroSlide {
  keycode: string;
  fallbackSrc: string;
  position: string;
}

/** 톤 색상 프리셋 — 사이트 팔레트 기반 */
const TINT_PRESETS: { color: string; label: string }[] = [
  { color: '#090705', label: '먹' },
  { color: '#21130f', label: '엄버' },
  { color: '#8f211d', label: '진홍' },
  { color: '#d4a017', label: '금' },
  { color: '#24425e', label: '쪽빛' },
];

/**
 * 조절 값(draft)을 #hero의 CSS 변수로 즉시 반영한다.
 * 공개 화면과 같은 변수를 쓰므로 슬라이더를 움직이는 순간 배경에 그대로 보인다.
 * null이면 변수를 제거해 globals.css 기본값으로 되돌린다.
 */
function applyOverlayVars(overlay: HeroOverlay | null) {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const vars = toHeroCssVars(overlay);
  for (const name of HERO_OVERLAY_CSS_VARS) {
    if (vars[name] !== undefined) hero.style.setProperty(name, vars[name]);
    else hero.style.removeProperty(name);
  }
}

/**
 * Hero 배경 슬라이드 관리 모달.
 * 편집 모드일 때 히어로 영역에 떠 있는 진입 버튼을 노출하고, 클릭하면 별도의 모달에서
 * 배경 3장을 한곳에 모아 교체·관리한다. 상단 툴바·헤더와 UI가 겹치지 않게 한다.
 * 각 슬라이드는 ImageObject의 기존 편집 모달을 그대로 사용하며, 교체 결과는
 * 동일 keycode를 쓰는 실제 배경 슬라이드에도 즉시 반영된다.
 *
 * 화면 톤·필터: 이미지 밝기·어둡기·색 틴트를 슬라이더로 조절한다.
 * 조절 중(포인터를 누르고 있는 동안)에는 모달이 잠시 투명해져(peek)
 * 실제 배경을 보면서 실시간으로 맞출 수 있다. 저장 전 닫으면 원래 값으로 복원.
 */
export default function HeroBackgroundManager({
  slides,
  initialOverlay = null,
}: {
  slides: HeroSlide[];
  initialOverlay?: HeroOverlay | null;
}) {
  const [open, setOpen] = useState(false);
  // saved = 마지막으로 저장된 값(null = 기본값), draft = 편집 중인 값
  const [saved, setSaved] = useState<HeroOverlay | null>(initialOverlay);
  const [draft, setDraft] = useState<HeroOverlay>(initialOverlay ?? DEFAULT_HERO_OVERLAY);
  // 슬라이더 드래그 중 모달을 투명하게(hold-to-peek). pinned는 눈 버튼으로 고정.
  const [peeking, setPeeking] = useState(false);
  const [pinnedPeek, setPinnedPeek] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = serializeHeroOverlay(draft) !== serializeHeroOverlay(saved ?? DEFAULT_HERO_OVERLAY);

  // ESC로 모달 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // hold-to-peek: 슬라이더에서 포인터를 떼면 모달 복귀
  useEffect(() => {
    if (!peeking) return;
    const end = () => setPeeking(false);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [peeking]);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const update = useCallback((patch: Partial<HeroOverlay>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      applyOverlayVars(next);
      return next;
    });
    setFeedback(null);
  }, []);

  const handleOpen = () => {
    // 열 때마다 저장된 값에서 시작(이전에 저장 없이 닫은 편집은 버려진 상태)
    setDraft(saved ?? DEFAULT_HERO_OVERLAY);
    setFeedback(null);
    setPinnedPeek(false);
    setOpen(true);
  };

  const handleClose = useCallback(() => {
    // 저장하지 않은 조절은 화면에서도 원래 값으로 복원
    applyOverlayVars(saved);
    setOpen(false);
  }, [saved]);

  const handleReset = () => {
    update({ ...DEFAULT_HERO_OVERLAY });
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hero.overlay', value: serializeHeroOverlay(draft) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '저장 실패');
      setSaved(draft);
      setFeedback('saved');
    } catch {
      setFeedback('error');
    } finally {
      setSaving(false);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(null), 2500);
    }
  };

  // 슬라이더 공통: 누르는 동안 peek
  const sliderPeekProps = {
    onPointerDown: () => setPeeking(true),
  };

  const isPeeking = peeking || pinnedPeek;

  return (
    <>
      <button
        type="button"
        className="section-edit-btn section-edit-btn--hero"
        onClick={handleOpen}
        title="Hero 섹션 설정"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>Hero 섹션 설정</span>
      </button>

      {open && createPortal(
        <div
          className={`hero-bg-manager-overlay ${isPeeking ? 'is-peeking' : ''}`}
          onClick={handleClose}
        >
          <div className="hero-bg-manager-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hero-bg-manager-header">
              <div className="hero-bg-manager-title">
                <h3>Hero 배경 이미지</h3>
                <p>홈 화면 상단에 순환 노출되는 배경 사진 3장을 관리합니다.</p>
              </div>
              <button
                type="button"
                className="hero-bg-manager-close"
                onClick={handleClose}
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

            {/* ── 화면 톤 · 필터 ─────────────────────────────────────── */}
            <div className="hero-tone-section">
              <div className="hero-tone-head">
                <h4>화면 톤 · 필터</h4>
                <button
                  type="button"
                  className={`hero-tone-peek-btn ${pinnedPeek ? 'active' : ''}`}
                  onClick={() => setPinnedPeek((v) => !v)}
                  title={pinnedPeek ? '설정 창 다시 보기' : '창을 투명하게 하고 배경 확인'}
                >
                  {pinnedPeek ? '창 다시 보기' : '배경 크게 보기'}
                </button>
              </div>

              <div className="hero-tone-row">
                <label htmlFor="hero-tone-image">이미지 밝기</label>
                <input
                  id="hero-tone-image"
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(draft.imageOpacity * 100)}
                  onChange={(e) => update({ imageOpacity: Number(e.target.value) / 100 })}
                  {...sliderPeekProps}
                />
                <span className="hero-tone-value">{Math.round(draft.imageOpacity * 100)}%</span>
              </div>

              <div className="hero-tone-row">
                <label htmlFor="hero-tone-dim">어둡기</label>
                <input
                  id="hero-tone-dim"
                  type="range"
                  min={0}
                  max={200}
                  value={Math.round(draft.dim * 100)}
                  onChange={(e) => update({ dim: Number(e.target.value) / 100 })}
                  {...sliderPeekProps}
                />
                <span className="hero-tone-value">{Math.round(draft.dim * 100)}%</span>
              </div>

              <div className="hero-tone-row">
                <span className="hero-tone-label">톤 색상</span>
                <div className="hero-tone-swatches">
                  {TINT_PRESETS.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      className={`hero-tone-swatch ${draft.tintColor === preset.color ? 'active' : ''}`}
                      style={{ background: preset.color }}
                      onClick={() => update({ tintColor: preset.color })}
                      title={preset.label}
                      aria-label={`톤 색상: ${preset.label}`}
                    />
                  ))}
                  <input
                    type="color"
                    className="hero-tone-color-input"
                    value={draft.tintColor}
                    onChange={(e) => update({ tintColor: e.target.value })}
                    title="직접 선택"
                  />
                </div>
              </div>

              <div className="hero-tone-row">
                <label htmlFor="hero-tone-strength">톤 강도</label>
                <input
                  id="hero-tone-strength"
                  type="range"
                  min={0}
                  max={80}
                  value={Math.round(draft.tintStrength * 100)}
                  onChange={(e) => update({ tintStrength: Number(e.target.value) / 100 })}
                  {...sliderPeekProps}
                />
                <span className="hero-tone-value">{Math.round(draft.tintStrength * 100)}%</span>
              </div>

              <div className="hero-tone-row">
                <label htmlFor="hero-tone-blend">톤 방식</label>
                <select
                  id="hero-tone-blend"
                  className="hero-tone-blend-select"
                  value={draft.tintBlend}
                  onChange={(e) => update({ tintBlend: e.target.value as HeroTintBlend })}
                >
                  {HERO_TINT_BLENDS.map((blend) => (
                    <option key={blend.value} value={blend.value}>
                      {blend.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hero-tone-actions">
                {feedback === 'saved' && <span className="hero-tone-feedback">저장되었습니다 ✓</span>}
                {feedback === 'error' && (
                  <span className="hero-tone-feedback hero-tone-feedback--error">저장에 실패했습니다</span>
                )}
                <button type="button" className="hero-tone-btn" onClick={handleReset}>
                  기본값으로
                </button>
                <button
                  type="button"
                  className="hero-tone-btn hero-tone-btn--primary"
                  onClick={handleSave}
                  disabled={saving || !dirty}
                >
                  {saving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>

            <p className="hero-bg-manager-hint">
              각 사진 위의 연필 아이콘을 눌러 이미지를 교체하거나 대체 텍스트를 수정할 수 있습니다.
              슬라이더는 누르고 있는 동안 창이 투명해져 실제 배경을 보면서 조절할 수 있습니다.
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
