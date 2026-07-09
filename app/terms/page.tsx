/**
 * 이용약관 — /terms
 * 문안: lib/legalContent.ts (⚠️ 초안 — 오픈 전 원장·법률 검토 필요)
 */

import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LegalDocument from '@/components/legal/LegalDocument';

export const metadata: Metadata = {
  title: '이용약관',
  description: 'KTDOC 춤누리 한국전통무용학원 웹사이트의 이용 조건을 안내합니다.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="legal-page">
        <LegalDocument doc="terms" />
      </main>
      <Footer />
    </>
  );
}
