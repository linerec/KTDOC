import type { Metadata, Viewport } from 'next';
import { Noto_Serif_KR, Outfit } from 'next/font/google';
import Providers from '@/components/Providers';
import PWARegister from '@/components/PWARegister';
import { getSettings, SETTING_HEADER_BACKGROUND } from '@/lib/d1';
import { parseHeaderBackground, toHeaderCssVars, DEFAULT_HEADER_BACKGROUND } from '@/lib/headerBackground';
import { SITE_URL, SETTING_SEO_BUSINESS, parseSeoBusiness, buildBusinessJsonLd } from '@/lib/seoBusiness';
import { SiteBusinessProvider } from '@/contexts/SiteBusinessContext';
import { buildThemeBootScript } from '@/lib/theme';
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
    // 'default' = 상태바 글자 어두움 + 콘텐츠는 상태바 아래에서 시작.
    // 앱의 착지면인 관리 콘솔이 라이트(아이보리 상단바)가 기본이라, 흰 글자로 고정되는
    // 'black-translucent'에서는 시간·배터리가 보이지 않았다. 상태바 배경은 아래
    // theme-color가 정하고, 콘솔 테마에 따라 AdminThemeContext가 갱신한다.
    statusBarStyle: 'default',
  },
  // 홈 화면 추가 시 열리는 주소는 매니페스트 start_url('/app')이 정한다.
  // 매니페스트는 사이트 전체가 하나를 쓴다 — 페이지별로 갈아끼우면 "문서를 처음 연 주소"에
  // 좌우돼 대시보드에서 추가해도 공개 메인이 등록되는 문제가 생긴다.
  manifest: '/manifest.webmanifest',
};

// themeColor는 여기서 내보내지 않는다 — 상태바 색이 경로·콘솔 테마에 따라 달라져야 하는데,
// Next가 렌더한 meta를 스크립트로 고치면 React가 하이드레이션에서 값 불일치를 보고 사본을
// 하나 더 만든다(태그 2개). 아래 부트 스크립트가 태그를 직접 만들어 단독으로 소유한다.
export const viewport: Viewport = {
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

  // 테마 부트 스크립트 — 첫 페인트 전에 테마를 결정해 깜빡임(FOUC)을 막는다.
  // 공개 사이트와 관리 콘솔이 각자의 선호를 갖고, 둘 다 기본값은 라이트다
  // (저장값이 정확히 'dark'일 때만 다크). 규칙·상수·생성은 lib/theme.ts가 갖는다.
  //
  // 반드시 <head> 안 **동기** 스크립트여야 한다(defer/async 금지). 공개 HTML은
  // ISR·서비스워커 캐시로 모든 방문자가 공유하므로 서버는 테마를 알 수 없고,
  // 알아서도 안 된다 — 첫 사용자의 테마가 캐시에 굳어 남에게 서빙된다.
  const themeBootScript = buildThemeBootScript();

  return (
    // suppressHydrationWarning: 테마 부트 스크립트가 하이드레이션 전에
    // <html data-site-theme|data-admin-theme>를 설정하므로 이 요소의 속성 비교 경고만
    // 억제한다(1뎁스 한정)
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
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
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
