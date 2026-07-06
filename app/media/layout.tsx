/**
 * Media Layout
 * 뉴스 & 미디어 페이지 공통 레이아웃
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function MediaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
