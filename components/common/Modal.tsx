'use client';

/**
 * Modal — 공용 대화상자
 *
 * 이 프로젝트에는 모달이 여럿 있지만 각자 구현이라 ESC·스크롤 잠금·포커스
 * 처리가 제각각이다. 새로 만드는 모달은 이것을 쓴다.
 *
 *   <Modal open={open} onClose={close} label="신청서">…</Modal>
 *
 * 맡는 일:
 *  - body에 포털로 붙인다 — sticky 사이드바나 overflow:hidden 조상에 갇히지 않는다
 *  - ESC·배경 클릭으로 닫는다
 *  - 열려 있는 동안 배경 스크롤을 잠근다(스크롤바 폭을 보정해 화면이 튀지 않게)
 *  - 열 때 포커스를 안으로, 닫을 때 **열었던 그 버튼으로** 돌려준다
 *  - 탭이 모달 밖으로 새지 않게 가둔다
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/lib/i18n/useT';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** 스크린리더가 읽을 대화상자 이름. */
  label: string;
  /** 헤더에 보일 제목. 없으면 헤더에 닫기 버튼만 놓는다. */
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export default function Modal({ open, onClose, label, title, children, className }: ModalProps) {
  const t = useT();
  const shellRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // 열 때의 포커스를 기억해 뒀다가 닫을 때 그 자리로 돌려준다.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const shell = shellRef.current;
    // 첫 입력칸으로 바로 보내면 화면 낭독이 제목을 건너뛰므로 껍데기에 준다.
    shell?.focus();
    return () => {
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  // 배경 스크롤 잠금. 스크롤바가 사라지며 화면이 옆으로 튀지 않게 폭을 채운다.
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const barWidth = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (barWidth > 0) body.style.paddingRight = `${barWidth}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      // 탭 가두기 — 마지막에서 앞으로, 처음에서 뒤로 돌아온다.
      const shell = shellRef.current;
      if (!shell) return;
      const items = Array.from(shell.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!mounted || !open) return null;

  return createPortal(
    /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={shellRef}
        className={className ? `modal-shell ${className}` : 'modal-shell'}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-bar">
          {title ? <h2 className="modal-title">{title}</h2> : <span />}
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={t('common.close', '닫기')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
