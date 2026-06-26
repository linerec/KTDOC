'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  DEFAULT_HEADER_BACKGROUND,
  parseHeaderBackground,
  serializeHeaderBackground,
  toRgba,
  type HeaderBackground,
  type HeaderLogoVariant,
  type HeaderStatePair,
} from '@/lib/headerBackground';
import { useHeaderSettings } from '@/contexts/HeaderSettingsContext';

const SETTING_KEY = 'header.background';

/** 모달 진입 시 body의 data 속성에서 현재 설정값을 읽는다. 없으면 기본값(=현재 CSS 동작). */
function readInitial(): HeaderBackground {
  if (typeof document !== 'undefined') {
    const parsed = parseHeaderBackground(document.body.dataset.headerBg ?? null);
    if (parsed) return parsed;
  }
  return DEFAULT_HEADER_BACKGROUND;
}

/**
 * 헤더(Top Bar) 배경 편집기.
 * 관리자 + 편집 모드일 때만 Header에서 렌더된다.
 * 최상단(top)·스크롤 후(scrolled) 두 상태의 배경/로고/메뉴 글자색을 각각 지정한다.
 */
export default function HeaderBackgroundEditor() {
  const router = useRouter();
  const { logo, setLogo } = useHeaderSettings();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [bg, setBg] = useState<HeaderBackground>(DEFAULT_HEADER_BACKGROUND);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 모달 열 때의 헤더 상태 백업 (취소 시 원복용)
  const backupRef = useRef<{
    top: string;
    scrolled: string;
    navColorTop: string;
    navColorScrolled: string;
    logo: HeaderStatePair<HeaderLogoVariant>;
  }>({
    top: '',
    scrolled: '',
    navColorTop: '',
    navColorScrolled: '',
    logo: DEFAULT_HEADER_BACKGROUND.logo,
  });

  useEffect(() => setMounted(true), []);

  // 미리보기: 값이 바뀔 때마다 실제 헤더에 실시간 반영
  useEffect(() => {
    if (!open) return;
    document.body.style.setProperty('--header-bg-top', toRgba(bg.top));
    document.body.style.setProperty('--header-bg-scrolled', toRgba(bg.scrolled));
    document.body.style.setProperty('--header-nav-color-top', bg.navColor.top);
    document.body.style.setProperty('--header-nav-color-scrolled', bg.navColor.scrolled);
    setLogo(bg.logo);
  }, [open, bg, setLogo]);

  const restoreBackup = useCallback(() => {
    const { top, scrolled, navColorTop, navColorScrolled, logo: prevLogo } = backupRef.current;
    if (top) document.body.style.setProperty('--header-bg-top', top);
    else document.body.style.removeProperty('--header-bg-top');
    if (scrolled) document.body.style.setProperty('--header-bg-scrolled', scrolled);
    else document.body.style.removeProperty('--header-bg-scrolled');
    if (navColorTop) document.body.style.setProperty('--header-nav-color-top', navColorTop);
    else document.body.style.removeProperty('--header-nav-color-top');
    if (navColorScrolled) document.body.style.setProperty('--header-nav-color-scrolled', navColorScrolled);
    else document.body.style.removeProperty('--header-nav-color-scrolled');
    setLogo(prevLogo);
  }, [setLogo]);

  const handleOpen = () => {
    backupRef.current = {
      top: document.body.style.getPropertyValue('--header-bg-top'),
      scrolled: document.body.style.getPropertyValue('--header-bg-scrolled'),
      navColorTop: document.body.style.getPropertyValue('--header-nav-color-top'),
      navColorScrolled: document.body.style.getPropertyValue('--header-nav-color-scrolled'),
      logo,
    };
    setBg(readInitial());
    setError('');
    setOpen(true);
  };

  const handleCancel = () => {
    restoreBackup();
    setOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const value = serializeHeaderBackground(bg);
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SETTING_KEY, value }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '저장에 실패했습니다.');
      }
      // 다음 편집 진입 시 초기값이 맞도록 data 속성도 동기화
      document.body.dataset.headerBg = value;
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SETTING_KEY, value: null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '복원에 실패했습니다.');
      }
      // 인라인 변수와 data 속성을 제거하여 CSS 기본값으로 되돌린다
      document.body.style.removeProperty('--header-bg-top');
      document.body.style.removeProperty('--header-bg-scrolled');
      document.body.style.removeProperty('--header-nav-color-top');
      document.body.style.removeProperty('--header-nav-color-scrolled');
      delete document.body.dataset.headerBg;
      setLogo(DEFAULT_HEADER_BACKGROUND.logo);
      backupRef.current = {
        top: '',
        scrolled: '',
        navColorTop: '',
        navColorScrolled: '',
        logo: DEFAULT_HEADER_BACKGROUND.logo,
      };
      setBg(DEFAULT_HEADER_BACKGROUND);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '복원에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const updateColor = (key: 'top' | 'scrolled', color: string) =>
    setBg((prev) => ({ ...prev, [key]: { ...prev[key], color } }));

  const updateOpacity = (key: 'top' | 'scrolled', percent: number) =>
    setBg((prev) => ({ ...prev, [key]: { ...prev[key], opacity: percent / 100 } }));

  const updateLogo = (key: 'top' | 'scrolled', variant: HeaderLogoVariant) =>
    setBg((prev) => ({ ...prev, logo: { ...prev.logo, [key]: variant } }));

  const updateNavColor = (key: 'top' | 'scrolled', color: string) =>
    setBg((prev) => ({ ...prev, navColor: { ...prev.navColor, [key]: color } }));

  // 한 상태(최상단 또는 스크롤 후)의 배경/로고/메뉴 글자색을 한 섹션에 묶어 렌더
  const renderStateSection = (key: 'top' | 'scrolled', title: string, hint: string) => {
    const state = bg[key];
    const percent = Math.round(state.opacity * 100);
    const logoVariant = bg.logo[key];
    const navColor = bg.navColor[key];
    return (
      <div className="header-bg-section">
        <div className="header-bg-section-head">
          <span className="header-bg-section-title">{title}</span>
          <span className="header-bg-section-hint">{hint}</span>
        </div>

        <div className="header-bg-row">
          <span className="header-bg-row-label">배경</span>
          <div className="header-bg-controls">
            <input
              type="color"
              aria-label={`${title} 배경 색상`}
              value={state.color}
              onChange={(e) => updateColor(key, e.target.value)}
              className="header-bg-color"
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              aria-label={`${title} 배경 투명도`}
              value={percent}
              onChange={(e) => updateOpacity(key, Number(e.target.value))}
              className="header-bg-range"
            />
            <span className="header-bg-percent">{percent}%</span>
            <span className="header-bg-swatch" title="미리보기">
              <span style={{ background: toRgba(state) }} />
            </span>
          </div>
        </div>

        <div className="header-bg-row">
          <span className="header-bg-row-label">로고</span>
          <div className="header-logo-options">
            <button
              type="button"
              className={`header-logo-option ${logoVariant === 'white' ? 'active' : ''}`}
              onClick={() => updateLogo(key, 'white')}
              aria-pressed={logoVariant === 'white'}
            >
              화이트
            </button>
            <button
              type="button"
              className={`header-logo-option ${logoVariant === 'default' ? 'active' : ''}`}
              onClick={() => updateLogo(key, 'default')}
              aria-pressed={logoVariant === 'default'}
            >
              일반
            </button>
          </div>
        </div>

        <div className="header-bg-row">
          <span className="header-bg-row-label">메뉴 글자색</span>
          <div className="header-bg-controls">
            <input
              type="color"
              aria-label={`${title} 메뉴 글자색`}
              value={navColor}
              onChange={(e) => updateNavColor(key, e.target.value)}
              className="header-bg-color"
            />
            <span className="header-bg-nav-hex">{navColor.toUpperCase()}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        className="section-edit-btn section-edit-btn--topbar"
        onClick={handleOpen}
        title="Top Bar 설정"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>Top Bar 설정</span>
      </button>

      {open && mounted && createPortal(
        <div className="image-object-modal-overlay" onClick={handleCancel}>
          <div className="image-object-modal header-bg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-object-modal-header">
              <h3>Top Bar 설정</h3>
              <button onClick={handleCancel} aria-label="닫기">&times;</button>
            </div>

            <div className="image-object-modal-body">
              <p className="header-bg-modal-hint">
                상단 바의 배경·로고·메뉴 글자색을 지정합니다. 최상단(스크롤 전)과 스크롤 후 상태를 각각 설정할 수 있습니다.
                변경 사항은 위 헤더에 바로 미리 보입니다.
              </p>

              {error && <div className="intl-modal-error">{error}</div>}

              {renderStateSection('top', '최상단', '페이지 맨 위 (스크롤 전)')}
              {renderStateSection('scrolled', '스크롤 후', '아래로 스크롤하여 헤더가 고정된 상태')}

              <button
                type="button"
                className="header-bg-reset"
                onClick={handleReset}
                disabled={saving}
              >
                기본값으로 복원
              </button>
            </div>

            <div className="image-object-modal-footer">
              <button onClick={handleCancel} disabled={saving}>취소</button>
              <button onClick={handleSave} disabled={saving}>
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
