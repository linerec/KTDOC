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
  title: 'KTDOC - Korean Traditional Performance',
  description: 'KTDOC - 한국 전통 공연 예술의 아름다움을 전합니다.',
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
