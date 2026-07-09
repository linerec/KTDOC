/**
 * 개인정보처리방침 — /privacy
 * 문안: lib/legalContent.ts (⚠️ 초안 — 오픈 전 원장·법률 검토 필요)
 */

import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LegalDocument from '@/components/legal/LegalDocument';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description:
    'KTDOC 춤누리 한국전통무용학원이 회원과 자녀의 개인정보를 어떻게 수집·이용·보호하는지 안내합니다.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="legal-page">
        <LegalDocument doc="privacy" />
      </main>
      <Footer />
    </>
  );
}
