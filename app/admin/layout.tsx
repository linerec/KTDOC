/**
 * Admin Layout
 * 관리자 페이지 공통 레이아웃
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="admin-layout">
        {children}
      </div>
      <Footer />
    </>
  );
}
