import type { Metadata } from 'next';
import { Noto_Serif_KR, Outfit } from 'next/font/google';
import Providers from '@/components/Providers';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${notoSerifKr.variable} ${outfit.variable}`}>
      <body>
        <Providers>
          <div className="bg-layer" aria-hidden="true" />
          <div className="site-wrapper">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
