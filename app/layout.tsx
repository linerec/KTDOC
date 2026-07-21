import type { Metadata, Viewport } from 'next';
import { Noto_Serif_KR, Outfit } from 'next/font/google';
import Providers from '@/components/Providers';
import PWARegister from '@/components/PWARegister';
import { getSettings, SETTING_HEADER_BACKGROUND } from '@/lib/d1';
import { parseHeaderBackground, toHeaderCssVars, DEFAULT_HEADER_BACKGROUND } from '@/lib/headerBackground';
import { SITE_URL, SETTING_SEO_BUSINESS, parseSeoBusiness, buildBusinessJsonLd } from '@/lib/seoBusiness';
import { SiteBusinessProvider } from '@/contexts/SiteBusinessContext';
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
  metadataBase: new URL(SITE_URL),
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
  appleWebApp: {
    capable: true,
    title: 'KTDOC',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 한지에 스며드는 먹: 글로벌 앰비언트 잉크 레이어. NEXT_PUBLIC_INK_AMBIENT=off 로 끌 수 있다.
  const inkAmbient = process.env.NEXT_PUBLIC_INK_AMBIENT !== 'off';

  // 관리자가 지정한 헤더(Top Bar) 배경과 SEO 비즈니스 정보(NAP)를 한 번에 읽는다.
  // 설정이 없으면 각자의 기본 동작이 유지되고, 실패하더라도 레이아웃 렌더는 막지 않는다.
  let settings: Record<string, string> = {};
  try {
    settings = await getSettings([SETTING_HEADER_BACKGROUND, SETTING_SEO_BUSINESS]);
  } catch {
    settings = {};
  }
  const headerBgRaw = settings[SETTING_HEADER_BACKGROUND] ?? null;
  const headerBg = parseHeaderBackground(headerBgRaw);
  const headerCssVars = toHeaderCssVars(headerBg);
  const headerLogo = headerBg?.logo ?? DEFAULT_HEADER_BACKGROUND.logo;
  const headerAlign = headerBg?.align ?? DEFAULT_HEADER_BACKGROUND.align;

  // 로컬 SEO 구조화 데이터: /admin/seo에서 입력한 NAP로 LocalBusiness JSON-LD를 게시한다.
  // 주소가 아직 없으면 Organization 수준으로만 게시된다(lib/seoBusiness 참고).
  const seoBusiness = parseSeoBusiness(settings[SETTING_SEO_BUSINESS] ?? null);
  const businessJsonLd = JSON.stringify(buildBusinessJsonLd(seoBusiness)).replace(/</g, '\\u003c');

  // 관리 콘솔 테마 부트 스크립트 — /admin SSR 진입 시 첫 페인트 전에 테마를 결정해
  // 깜빡임(FOUC)을 막는다. 콘솔 기본값은 라이트: 저장 선호가 'dark'일 때만 다크.
  // 경로 가드로 공개 페이지에는 절대 속성이 붙지 않으며(공개 사이트는 항상 다크),
  // 콘솔 이탈 시 제거는 AdminThemeProvider가 한다.
  // 저장 키는 AdminThemeContext의 STORAGE_KEY('admin-theme')와 짝 — 함께 바꿀 것.
  const adminThemeBootScript =
    "(function(){var t=null;try{t=localStorage.getItem('admin-theme')}catch(e){}if(location.pathname.startsWith('/admin')&&t!=='dark'){document.documentElement.dataset.adminTheme='light'}})()";

  return (
    // suppressHydrationWarning: 관리 콘솔 테마 부트 스크립트가 하이드레이션 전에
    // <html data-admin-theme>를 설정하므로 이 요소의 속성 비교 경고만 억제한다(1뎁스 한정)
    <html
      lang="ko"
      className={`${notoSerifKr.variable} ${outfit.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* JS 비활성 시 스크롤 리빌 요소가 숨겨진 채 남지 않도록 폴백 */}
        <noscript>
          <style>{`.reveal{opacity:1 !important;transform:none !important;filter:none !important;}`}</style>
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: businessJsonLd }}
        />
        <script dangerouslySetInnerHTML={{ __html: adminThemeBootScript }} />
      </head>
      <body style={headerCssVars as React.CSSProperties} data-header-bg={headerBgRaw ?? undefined}>
        <Providers initialLogo={headerLogo} initialAlign={headerAlign}>
          <SiteBusinessProvider info={seoBusiness}>
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
            <PWARegister />
          </SiteBusinessProvider>
        </Providers>
      </body>
    </html>
  );
}
