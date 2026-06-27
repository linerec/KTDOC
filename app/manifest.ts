import type { MetadataRoute } from 'next';

/**
 * PWA 매니페스트 — 홈 화면 설치 + 앱(standalone) 표시.
 * 아이콘은 SVG 한 장(public/icon.svg)으로 모든 크기를 커버한다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KTDOC 춤누리',
    short_name: 'KTDOC',
    description: '춤누리 한국전통무용단 — 이벤트 참여·일정 관리',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    lang: 'ko',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
