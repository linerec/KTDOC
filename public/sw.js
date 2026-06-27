/**
 * KTDOC 서비스워커 (최소)
 * - 설치 가능성(PWA) 확보 + GET 요청 네트워크 우선.
 * - 인증/관리 콘텐츠가 stale되지 않도록 적극적 캐싱은 하지 않는다.
 *   네트워크 실패 시에만 캐시 폴백(있으면).
 */
const CACHE = 'ktdoc-runtime-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 같은 출처의 정적 자산만 가볍게 캐시(네트워크 우선). API/관리/인증은 캐시하지 않음.
  const isCacheable =
    url.origin === self.location.origin &&
    !url.pathname.startsWith('/api') &&
    !url.pathname.startsWith('/admin');

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isCacheable && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
