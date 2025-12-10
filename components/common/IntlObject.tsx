'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBuilder } from '@/contexts/BuilderContext';

type ReturnType = 'div' | 'span' | 'p' | 'label' | 'h1' | 'h2' | 'h3';

interface IntlObjectProps {
  keycode: string;
  returnType?: ReturnType;
  className?: string;
  style?: React.CSSProperties;
  isLogin?: boolean;
}

interface LocaleData {
  ko: string;
  en: string;
}

export default function IntlObject({
  keycode,
  returnType = 'span',
  className = '',
  style = {},
  isLogin,
}: IntlObjectProps) {
  const { data: session } = useSession();
  const { locale, messages, allMessages, refreshMessages } = useLanguage();
  const { isEditMode } = useBuilder();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localeData, setLocaleData] = useState<LocaleData>({ ko: '', en: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const canEdit = isLogin !== undefined ? isLogin : !!session;
  const isEditable = canEdit && isEditMode;

  const message = messages[keycode] || keycode;

  const handleClick = useCallback(async () => {
    if (!isEditable) return;

    // Load current values from allMessages
    setLocaleData({
      ko: allMessages.ko[keycode] || '',
      en: allMessages.en[keycode] || '',
    });
    setError('');
    setIsModalOpen(true);
  }, [isEditable, keycode, allMessages]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keycode,
          localeData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '저장에 실패했습니다.');
        return;
      }

      await refreshMessages();
      setIsModalOpen(false);
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [keycode, localeData, refreshMessages]);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    setError('');
  }, []);

  const editableStyle: React.CSSProperties = isEditable
    ? {
        cursor: 'pointer',
        outline: '1px dashed rgba(212, 160, 23, 0.5)',
        outlineOffset: '2px',
        position: 'relative',
        ...style,
      }
    : style;

  // Modal rendered via Portal to avoid HTML nesting issues
  const modal = isModalOpen && mounted ? createPortal(
    <div className="intl-modal-overlay" onClick={handleClose}>
      <div className="intl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="intl-modal-header">
          <h3>번역 편집</h3>
          <button className="intl-modal-close" onClick={handleClose}>
            &times;
          </button>
        </div>

        <div className="intl-modal-body">
          {error && <div className="intl-modal-error">{error}</div>}

          <div className="intl-modal-field">
            <label>키코드</label>
            <input type="text" value={keycode} disabled />
          </div>

          <div className="intl-modal-field">
            <label>한국어</label>
            <textarea
              value={localeData.ko}
              onChange={(e) => setLocaleData({ ...localeData, ko: e.target.value })}
              rows={3}
              disabled={isSaving}
            />
          </div>

          <div className="intl-modal-field">
            <label>English</label>
            <textarea
              value={localeData.en}
              onChange={(e) => setLocaleData({ ...localeData, en: e.target.value })}
              rows={3}
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="intl-modal-footer">
          <button className="intl-btn-cancel" onClick={handleClose} disabled={isSaving}>
            취소
          </button>
          <button className="intl-btn-save" onClick={handleSave} disabled={isSaving}>
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  const content = (
    <>
      {isEditable && <span className="keycode-label keycode-label--intl">{keycode}</span>}
      <span dangerouslySetInnerHTML={{ __html: message }} />
      {modal}
    </>
  );

  const props = {
    className: `intl-object ${className}`.trim(),
    style: editableStyle,
    onClick: isEditable ? handleClick : undefined,
    'data-keycode': keycode,
    'data-locale': locale,
  };

  switch (returnType) {
    case 'div':
      return <div {...props}>{content}</div>;
    case 'p':
      return <p {...props}>{content}</p>;
    case 'label':
      return <label {...props}>{content}</label>;
    case 'h1':
      return <h1 {...props}>{content}</h1>;
    case 'h2':
      return <h2 {...props}>{content}</h2>;
    case 'h3':
      return <h3 {...props}>{content}</h3>;
    case 'span':
    default:
      return <span {...props}>{content}</span>;
  }
}
