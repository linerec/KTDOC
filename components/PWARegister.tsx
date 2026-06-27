'use client';

import { useEffect } from 'react';

/** PWA 서비스워커 등록(프로덕션). 실패해도 앱 동작에는 영향 없음. */
export default function PWARegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // dev에서는 등록하지 않을 뿐 아니라, 이전 프로덕션 실행에서 남은 SW를 적극적으로
    // 제거한다. 같은 출처(localhost)에서 dev로 돌아오면 옛 SW가 살아 _next 정적 청크를
    // stale하게 내어주고 → 풀 리로드 루프/Compiling 멈춤을 유발하기 때문.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) reg.unregister().catch(() => {});
      }).catch(() => {});
      if (typeof caches !== 'undefined') {
        caches.keys().then((keys) => {
          for (const k of keys) caches.delete(k).catch(() => {});
        }).catch(() => {});
      }
      return;
    }

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
