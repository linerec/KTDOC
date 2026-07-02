/**
 * Timeline Layout
 * 타임라인 페이지 공통 레이아웃
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function TimelineLayout({
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
