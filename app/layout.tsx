import type { Metadata } from 'next';
import { Noto_Serif_KR, Outfit } from 'next/font/google';
import Providers from '@/components/Providers';
import { getSetting, SETTING_HEADER_BACKGROUND } from '@/lib/d1';
import { parseHeaderBackground, toHeaderCssVars } from '@/lib/headerBackground';
import './globals.css';

const notoSerifKr = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  display: 'swap',
  variable: '--font-noto-serif-kr',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  display: 'swap',
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://ktdoc.org'),
  applicationName: 'KTDOC',
  title: {
    default: 'KTDOC | Korean Traditional Dance of Choomnoori',
    template: '%s | KTDOC',
  },
  description: '춤누리 한국전통무용학원은 한국 전통무용의 아름다움과 정신을 배우고, 나누고, 다음 세대에 전하는 문화예술 교육기관입니다.',
  keywords: [
    'KTDOC',
    'Choomnoori',
    'Korean Traditional Dance',
    'Korean dance',
    '한국전통무용',
    '춤누리',
    '뉴저지 한국무용',
    '전통무용 수업',
    'Korean cultural performance',
  ],
  authors: [{ name: 'KTDOC' }],
  creator: 'KTDOC',
  publisher: 'KTDOC',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'KTDOC | Korean Traditional Dance of Choomnoori',
    description: '한국 전통무용의 아름다움과 정신을 배우고, 나누고, 다음 세대에 전합니다.',
    url: '/',
    siteName: 'KTDOC',
    locale: 'ko_KR',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 600,
        height: 400,
        alt: 'KTDOC - Korean Traditional Dance of Choomnoori',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KTDOC | Korean Traditional Dance of Choomnoori',
    description: '한국 전통무용의 아름다움과 정신을 배우고, 나누고, 다음 세대에 전합니다.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  category: 'education',
  formatDetection: {
    telephone: false,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 한지에 스며드는 먹: 글로벌 앰비언트 잉크 레이어. NEXT_PUBLIC_INK_AMBIENT=off 로 끌 수 있다.
  const inkAmbient = process.env.NEXT_PUBLIC_INK_AMBIENT !== 'off';

  // 관리자가 지정한 헤더(Top Bar) 배경. 설정이 없으면 globals.css의 기본 동작이 그대로 유지된다.
  // 실패하더라도 레이아웃 렌더는 막지 않는다.
  let headerBgRaw: string | null = null;
  try {
    headerBgRaw = await getSetting(SETTING_HEADER_BACKGROUND);
  } catch {
    headerBgRaw = null;
  }
  const headerCssVars = toHeaderCssVars(parseHeaderBackground(headerBgRaw));

  return (
    <html lang="ko" className={`${notoSerifKr.variable} ${outfit.variable}`}>
      <head>
        {/* JS 비활성 시 스크롤 리빌 요소가 숨겨진 채 남지 않도록 폴백 */}
        <noscript>
          <style>{`.reveal{opacity:1 !important;transform:none !important;filter:none !important;}`}</style>
        </noscript>
      </head>
      <body style={headerCssVars as React.CSSProperties} data-header-bg={headerBgRaw ?? undefined}>
        <Providers>
          <div className="bg-layer" aria-hidden="true" />
          {inkAmbient && (
            <div className="ink-ambient" aria-hidden="true">
              <span className="ink-ambient__wash ink-ambient__wash--gold" />
              <span className="ink-ambient__wash ink-ambient__wash--ivory" />
              <span className="ink-ambient__wash ink-ambient__wash--ember" />
              <span className="ink-ambient__grain" />
            </div>
          )}
          <div className="site-wrapper">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
