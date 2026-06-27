'use client';

import { useEffect } from 'react';

/** PWA 서비스워커 등록(프로덕션). 실패해도 앱 동작에는 영향 없음. */
export default function PWARegister() {
  useEffect(() => {
    // dev에서는 SW가 정적 청크를 캐시해 HMR을 방해할 수 있어 프로덕션에서만 등록.
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* 등록 실패는 조용히 무시 */
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
