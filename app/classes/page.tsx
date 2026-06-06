/**
 * Classes & Programs Page
 * 수업·프로그램·캠프 — 대표 여름 캠프 스포트라이트 + 종류별 프로그램 그리드
 */

import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
import CampSpotlight from '@/components/classes/CampSpotlight';
import ProgramGrid from '@/components/classes/ProgramGrid';
import { getPrograms } from '@/lib/d1';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '수업 및 프로그램 | KTDOC',
  description:
    '춤누리 한국전통무용단의 수업, 프로그램, 여름 캠프 안내. 한국 전통무용을 통해 호흡·예절·문화적 뿌리를 함께 배웁니다.',
  alternates: { canonical: '/classes' },
  openGraph: {
    title: '수업 및 프로그램 | KTDOC',
    description: '춤누리 한국전통무용단의 수업, 프로그램, 여름 캠프 안내',
    url: '/classes',
  },
};

export default async function ClassesPage() {
  const { programs } = await getPrograms({ published: true, limit: 100 });

  const spotlightCamp =
    programs.find((p) => p.program_type === 'camp' && p.is_featured === 1) || null;

  const gridPrograms = spotlightCamp
    ? programs.filter((p) => p.id !== spotlightCamp.id)
    : programs;

  const hasContent = programs.length > 0;

  return (
    <>
      <Header />
      <main className="classes-page">
        {spotlightCamp ? (
          <CampSpotlight camp={spotlightCamp} />
        ) : (
          <section className="classes-hero">
            <div className="container">
              <p className="classes-hero-eyebrow">
                <IntlObject keycode="pages.classes.eyebrow" />
              </p>
              <IntlObject keycode="pages.classes.title" returnType="h1" className="classes-hero-title" />
              <IntlObject
                keycode="pages.classes.description"
                returnType="p"
                className="classes-hero-description"
              />
            </div>
          </section>
        )}

        <section className="classes-main">
          <div className="container">
            {hasContent ? (
              <ProgramGrid programs={gridPrograms} />
            ) : (
              <div className="classes-empty">
                <IntlObject keycode="pages.classes.status" returnType="p" />
              </div>
            )}
          </div>
        </section>

        <section className="classes-trust">
          <div className="container">
            <span className="dancheong-divider" aria-hidden="true" />
            <p className="classes-trust-title">
              <IntlObject keycode="pages.classes.trustTitle" />
            </p>
            <p className="classes-trust-body">
              <IntlObject keycode="pages.classes.trustBody" />
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
