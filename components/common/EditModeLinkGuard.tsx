'use client';

import { useEffect } from 'react';
import { useBuilder } from '@/contexts/BuilderContext';

/**
 * 편집 모드에서 링크 내비게이션을 차단한다.
 *
 * 편집 모드일 때는 화면 곳곳의 편집 가능한 요소(IntlObject 텍스트, ImageObject)가
 * <Link> 안에 들어있어, 편집하려고 클릭하면 페이지가 이동해버린다.
 * document 캡처 단계에서 a[href] 좌클릭의 기본 동작을 막아 SPA 이동과 브라우저
 * 기본 이동을 모두 차단한다. stopPropagation은 하지 않으므로 편집 모달은 그대로 열린다
 * (Next의 Link는 e.defaultPrevented면 router.push를 건너뛴다).
 *
 * 새 탭(target=_blank), 다운로드, 수식키(⌘/Ctrl/Shift/Alt)+클릭, 가운데 클릭은
 * 의도된 동작이므로 그대로 통과시킨다.
 */
export default function EditModeLinkGuard() {
  const { isEditMode } = useBuilder();

  useEffect(() => {
    if (!isEditMode) return;

    const isExemptAnchor = (anchor: HTMLAnchorElement | null): boolean =>
      !anchor || anchor.target === '_blank' || anchor.hasAttribute('download');

    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return; // 좌클릭만
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // 새 탭/창 열기 허용

      const target = e.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (isExemptAnchor(anchor)) return;

      // 네이티브 앵커 이동 + Next SPA 이동 모두 차단. (편집 onClick은 그대로 실행됨)
      e.preventDefault();
    };

    const onKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const el = document.activeElement as Element | null;
      const anchor = el?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (isExemptAnchor(anchor)) return;
      e.preventDefault();
    };

    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('keydown', onKeyDownCapture, true);

    return () => {
      document.removeEventListener('click', onClickCapture, true);
      document.removeEventListener('keydown', onKeyDownCapture, true);
    };
  }, [isEditMode]);

  return null;
}
