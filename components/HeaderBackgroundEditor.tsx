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
} from '@/lib/headerBackground';

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
 * 최상단(top)·스크롤 후(scrolled) 두 상태의 색상/투명도를 각각 지정한다.
 */
export default function HeaderBackgroundEditor() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [bg, setBg] = useState<HeaderBackground>(DEFAULT_HEADER_BACKGROUND);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 모달 열 때의 body 인라인 변수 백업 (취소 시 원복용)
  const backupRef = useRef<{ top: string; scrolled: string }>({ top: '', scrolled: '' });

  useEffect(() => setMounted(true), []);

  // 미리보기: 값이 바뀔 때마다 실제 헤더 배경에 실시간 반영
  useEffect(() => {
    if (!open) return;
    document.body.style.setProperty('--header-bg-top', toRgba(bg.top));
    document.body.style.setProperty('--header-bg-scrolled', toRgba(bg.scrolled));
  }, [open, bg]);

  const restoreBackup = useCallback(() => {
    const { top, scrolled } = backupRef.current;
    if (top) document.body.style.setProperty('--header-bg-top', top);
    else document.body.style.removeProperty('--header-bg-top');
    if (scrolled) document.body.style.setProperty('--header-bg-scrolled', scrolled);
    else document.body.style.removeProperty('--header-bg-scrolled');
  }, []);

  const handleOpen = () => {
    backupRef.current = {
      top: document.body.style.getPropertyValue('--header-bg-top'),
      scrolled: document.body.style.getPropertyValue('--header-bg-scrolled'),
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
      delete document.body.dataset.headerBg;
      backupRef.current = { top: '', scrolled: '' };
      setBg(DEFAULT_HEADER_BACKGROUND);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '복원에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const updateColor = (key: keyof HeaderBackground, color: string) =>
    setBg((prev) => ({ ...prev, [key]: { ...prev[key], color } }));

  const updateOpacity = (key: keyof HeaderBackground, percent: number) =>
    setBg((prev) => ({ ...prev, [key]: { ...prev[key], opacity: percent / 100 } }));

  const renderField = (key: keyof HeaderBackground, label: string, hint: string) => {
    const state = bg[key];
    const percent = Math.round(state.opacity * 100);
    return (
      <div className="header-bg-field">
        <div className="header-bg-field-head">
          <span className="header-bg-field-label">{label}</span>
          <span className="header-bg-field-hint">{hint}</span>
        </div>
        <div className="header-bg-controls">
          <input
            type="color"
            aria-label={`${label} 색상`}
            value={state.color}
            onChange={(e) => updateColor(key, e.target.value)}
            className="header-bg-color"
          />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            aria-label={`${label} 투명도`}
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
    );
  };

  return (
    <>
      <button
        type="button"
        className="edit-mode-toggle header-bg-edit-btn"
        onClick={handleOpen}
        title="헤더 배경색 편집"
      >
        배경
      </button>

      {open && mounted && createPortal(
        <div className="image-object-modal-overlay" onClick={handleCancel}>
          <div className="image-object-modal header-bg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-object-modal-header">
              <h3>헤더 배경 설정</h3>
              <button onClick={handleCancel} aria-label="닫기">&times;</button>
            </div>

            <div className="image-object-modal-body">
              <p className="header-bg-modal-hint">
                상단 바의 배경 색상과 투명도를 지정합니다. 최상단(스크롤 전)과 스크롤 후 상태를 각각 설정할 수 있습니다.
                변경 사항은 위 헤더에 바로 미리 보입니다.
              </p>

              {error && <div className="intl-modal-error">{error}</div>}

              {renderField('top', '최상단', '페이지 맨 위 (스크롤 전)')}
              {renderField('scrolled', '스크롤 후', '아래로 스크롤하여 헤더가 고정된 상태')}

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
