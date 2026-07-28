'use client';

/**
 * useStandalone — 홈 화면 아이콘으로 실행된 앱(standalone) 안인지.
 *
 * 브라우저 탭에서는 false, PWA로 설치돼 열렸으면 true. display-mode는 브라우저가
 * 소유한 상태이므로 구독해서 읽는다(useSyncExternalStore). SSR·하이드레이션 스냅샷은
 * 항상 false — 서버는 실행 환경을 알 수 없고, 여기서 틀리면 하이드레이션이 어긋난다.
 *
 * 쓰임새: 앱 안에서는 target="_blank"로 새 창을 열면 브라우저(Safari)로 튕겨나가
 * 앱 감각이 끊긴다. 그런 링크를 같은 창에서 열도록 분기할 때 쓴다.
 */

import { useSyncExternalStore } from 'react';

const QUERY = '(display-mode: standalone)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.(QUERY).matches === true ||
    // iOS Safari는 display-mode 대신 이 비표준 속성으로 알린다
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useStandalone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
