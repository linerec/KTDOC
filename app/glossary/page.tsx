/**
 * 말모이 (Word Guide) — 한국 전통무용 용어 사전 (공개)
 *
 * 미국의 학생·학부모가 한국 전통무용 용어를 한글·발음·뜻으로 찾아볼 수 있는 공개 페이지.
 * 운영진은 /admin/glossary에서 용어를 편집한다.
 *
 * 데이터: D1(glossary_terms + glossary_categories). 공개된(is_published=1) 용어만 노출.
 *   전량을 서버에서 로드해 클라이언트 브라우저(GlossaryBrowser)에서 검색·필터한다.
 */

import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
import GlossaryBrowser from '@/components/glossary/GlossaryBrowser';
import { getGlossaryTerms, getGlossaryCategories } from '@/lib/d1';

export const metadata: Metadata = {
  title: '말모이 · 용어집 | KTDOC',
  description:
    '한국 전통무용 용어를 한글·발음·뜻으로 찾아보세요. 춤누리 한국전통무용단이 정리한 용어 사전입니다.',
};

export default async function GlossaryPage() {
  const [{ terms }, categories] = await Promise.all([
    getGlossaryTerms({ published: true, limit: 1000 }),
    getGlossaryCategories(),
  ]);

  return (
    <>
      <Header />
      <main className="glossary-page">
        {/* 표준 히어로 골격(label/title/subtitle/description) — gallery-hero 캐노니컬을 따른다. */}
        <section className="glossary-hero">
          <div className="glossary-container">
            <IntlObject keycode="glossary.hero.label" className="glossary-hero-label" />
            <IntlObject keycode="glossary.title" returnType="h1" className="glossary-hero-title" />
            <IntlObject keycode="glossary.hero.subtitle" returnType="p" className="glossary-hero-subtitle" />
            <IntlObject keycode="glossary.lede" returnType="p" className="glossary-hero-description" />
          </div>
        </section>

        <section className="glossary-body">
          <div className="glossary-container">
            {terms.length === 0 ? (
              <IntlObject keycode="glossary.empty.page" returnType="p" className="glossary-empty" />
            ) : (
              <GlossaryBrowser terms={terms} categories={categories} />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
