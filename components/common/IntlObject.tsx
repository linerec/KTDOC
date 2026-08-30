'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBuilder } from '@/contexts/BuilderContext';
import { isAdmin } from '@/lib/isAdmin';
import { sanitizeRichText } from '@/lib/html/richText';
import RichTextEditor from './RichTextEditor';

type ReturnType = 'div' | 'span' | 'p' | 'label' | 'h1' | 'h2' | 'h3';

interface IntlObjectProps {
  keycode: string;
  returnType?: ReturnType;
  className?: string;
  style?: React.CSSProperties;
  isLogin?: boolean;
  /** 메시지 안의 {이름} 자리표시자를 치환할 값. 예: "참여 {n}회" + {n: 3} → "참여 3회" */
  params?: Record<string, string | number>;
  /**
   * 긴 본문(문단·목록이 든 글)인가.
   *
   * 켜면 편집 모달이 3줄짜리 textarea가 아니라 위지윅이 되고, 글이 블록 마크업이므로
   * 바깥 태그가 <div>가 된다(<span> 안의 <p>는 무효 마크업이라 브라우저가 밖으로
   * 밀어낸다 — 그러면 CSS가 글을 놓친다).
   *
   * 켜는 키코드는 lib/i18n/richKeys.ts 에도 적어야 한다. 서버가 그 목록을 보고
   * 저장할 때 정리한다.
   */
  rich?: boolean;
}

interface LocaleData {
  ko: string;
  en: string;
}

/** 쓰다 만 글을 브라우저에 남겨 두는 자리 */
const draftKeyOf = (keycode: string) => `ktdoc.intlDraft.${keycode}`;

function whenText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

export default function IntlObject({
  keycode,
  returnType,
  className = '',
  style = {},
  isLogin,
  params,
  rich = false,
}: IntlObjectProps) {
  const { data: session } = useSession();
  const { locale, messages, allMessages, refreshMessages } = useLanguage();
  const { isEditMode } = useBuilder();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localeData, setLocaleData] = useState<LocaleData>({ ko: '', en: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  /** 열었을 때의 원본 — 초안을 남길지, 무엇을 되돌릴지 판단하는 기준 */
  const opened = useRef<LocaleData>({ ko: '', en: '' });
  const [draftAt, setDraftAt] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const canEdit = isLogin !== undefined ? isLogin : isAdmin(session);
  const isEditable = canEdit && isEditMode;
  const tag: ReturnType = returnType ?? (rich ? 'div' : 'span');

  const rawMessage = messages[keycode] || keycode;
  // 편집 모달에는 자리표시자가 담긴 원문({n} 등)이 뜨고, 화면에는 치환된 값이 보인다
  const message = params
    ? Object.entries(params).reduce(
        (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
        rawMessage
      )
    : rawMessage;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return;

      // 편집 클릭이 부모 <Link>/네비게이션 버튼으로 전파/이동되지 않도록 차단
      e.preventDefault();
      e.stopPropagation();

      const current: LocaleData = {
        ko: allMessages.ko[keycode] || '',
        en: allMessages.en[keycode] || '',
      };
      opened.current = current;
      setLocaleData(current);
      setError('');
      setDraftAt(null);

      // 쓰다 만 글이 있으면 알린다 — 조용히 덮어쓰지 않는다. 어느 쪽이 최신인지는
      // 쓴 사람만 안다(다른 기기에서 저장했을 수도 있다).
      if (rich) {
        try {
          const raw = window.localStorage.getItem(draftKeyOf(keycode));
          if (raw) {
            const d = JSON.parse(raw) as LocaleData & { at?: string };
            if ((d.ko && d.ko !== current.ko) || (d.en && d.en !== current.en)) {
              setDraftAt(d.at ?? '');
            } else {
              window.localStorage.removeItem(draftKeyOf(keycode));
            }
          }
        } catch {
          /* 초안이 깨졌으면 없는 셈 친다 */
        }
      }

      setIsModalOpen(true);
    },
    [isEditable, keycode, allMessages, rich]
  );

  // 쓰는 동안 브라우저에 남긴다 — 긴 글을 쓰다 창을 닫으면 다시 쓸 마음이 나지 않는다.
  useEffect(() => {
    if (!isModalOpen || !rich) return;
    const changed =
      localeData.ko !== opened.current.ko || localeData.en !== opened.current.en;
    try {
      if (changed) {
        window.localStorage.setItem(
          draftKeyOf(keycode),
          JSON.stringify({ ...localeData, at: new Date().toISOString() })
        );
      }
    } catch {
      /* 저장 공간이 막혀 있어도 글쓰기를 막지는 않는다 */
    }
  }, [isModalOpen, rich, keycode, localeData]);

  const restoreDraft = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(draftKeyOf(keycode));
      if (!raw) return;
      const d = JSON.parse(raw) as LocaleData;
      setLocaleData({ ko: d.ko ?? '', en: d.en ?? '' });
    } catch {
      /* 무시 */
    }
    setDraftAt(null);
  }, [keycode]);

  const dropDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(draftKeyOf(keycode));
    } catch {
      /* 무시 */
    }
    setDraftAt(null);
  }, [keycode]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError('');

    // 긴 글은 보내기 전에 한 번 깎는다. 서버가 다시 깎지만, 여기서 깎아야 저장된
    // 것과 화면이 같아진다(서버가 다르게 깎으면 새로고침 전까지 모른다).
    const payload: LocaleData = rich
      ? { ko: sanitizeRichText(localeData.ko), en: sanitizeRichText(localeData.en) }
      : localeData;

    try {
      const response = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keycode, localeData: payload }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '저장에 실패했습니다.');
        return;
      }

      await refreshMessages();
      dropDraft();
      setIsModalOpen(false);
    } catch {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [keycode, localeData, rich, refreshMessages, dropDraft]);

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
  const modal =
    isModalOpen && mounted
      ? createPortal(
          <div className="intl-modal-overlay" onClick={handleClose}>
            <div
              className={`intl-modal${rich ? ' intl-modal--rich' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="intl-modal-header">
                <h3>{rich ? '내용 편집' : '번역 편집'}</h3>
                <button className="intl-modal-close" onClick={handleClose}>
                  &times;
                </button>
              </div>

              <div className="intl-modal-body">
                {error && <div className="intl-modal-error">{error}</div>}

                {draftAt !== null && (
                  <div className="intl-modal-draft">
                    <span>
                      쓰다 만 글이 있습니다{draftAt ? ` · ${whenText(draftAt)}` : ''}.
                    </span>
                    <button type="button" onClick={restoreDraft}>
                      이어서 쓰기
                    </button>
                    <button type="button" className="is-quiet" onClick={dropDraft}>
                      버리기
                    </button>
                  </div>
                )}

                <div className="intl-modal-field">
                  <label>키코드</label>
                  <input type="text" value={keycode} disabled readOnly />
                </div>

                {rich ? (
                  <>
                    <p className="intl-modal-hint">
                      엔터로 줄을 늘리세요 — 칸 수 제한이 없습니다. 워드·한글에서 붙여넣으면
                      서체와 색은 자동으로 정리되고 굵게·목록은 남습니다.
                    </p>
                    <div className="intl-modal-pair">
                      <RichTextEditor
                        label="한국어"
                        ariaLabel="한국어 내용"
                        value={localeData.ko}
                        onChange={(ko) => setLocaleData((p) => ({ ...p, ko }))}
                        disabled={isSaving}
                      />
                      <RichTextEditor
                        label="English"
                        ariaLabel="English content"
                        value={localeData.en}
                        onChange={(en) => setLocaleData((p) => ({ ...p, en }))}
                        disabled={isSaving}
                        placeholder="Write the English version here"
                      />
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
        )
      : null;

  const content = (
    <>
      {isEditable && <span className="keycode-label keycode-label--intl">{keycode}</span>}
      {rich ? (
        // 블록 마크업이라 <span>이 아니라 <div>에 담는다
        <div className="intl-rich" dangerouslySetInnerHTML={{ __html: message }} />
      ) : (
        <span dangerouslySetInnerHTML={{ __html: message }} />
      )}
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

  switch (tag) {
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
