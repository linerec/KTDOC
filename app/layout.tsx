import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import './globals.css';

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
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;700&family=Outfit:wght@300;400;600&display=swap" rel="stylesheet" />
      </head>
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
