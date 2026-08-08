/**
 * Program Detail Page
 * 수업·프로그램·캠프 상세 + 인라인 신청 폼(#apply)
 */

import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
import ImageGallery from '@/components/gallery/ImageGallery';
import RegistrationForm from '@/components/classes/RegistrationForm';
import ProgramDetailFacts from '@/components/classes/ProgramDetailFacts';
import ShareQrCard from '@/components/share/ShareQrCard';
import SupplyList from '@/components/supplies/SupplyList';
import { getProgramBySlug, incrementProgramViewCount, getProgramSupplies, getProgramSupplySets } from '@/lib/d1';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgramBySlug(decodeURIComponent(slug));

  if (!program || !program.is_published) {
    return { title: 'Not Found' };
  }

  const heroImage = program.poster_url || program.first_image_url || undefined;
  return {
    title: program.title_ko,
    description: program.summary_ko || program.description_ko || `${program.title_ko} 안내`,
    alternates: { canonical: `/classes/${slug}` },
    openGraph: {
      title: program.title_ko,
      description: program.summary_ko || program.description_ko || undefined,
      url: `/classes/${slug}`,
      type: 'article',
      siteName: 'KTDOC',
      locale: 'ko_KR',
      images: heroImage ? [{ url: heroImage, width: 1200, height: 630, alt: program.title_ko }] : undefined,
    },
  };
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const program = await getProgramBySlug(decodeURIComponent(slug));

  if (!program || !program.is_published) {
    notFound();
  }

  incrementProgramViewCount(program.id).catch(() => {});

  const [programSupplies, programSupplySets] = await Promise.all([
    getProgramSupplies(program.id),
    getProgramSupplySets(program.id),
  ]);
  const heroImage = program.poster_url || program.first_image_url || program.thumbnail_url;

  return (
    <>
      <Header />
      <main className="program-detail">
        <section className="program-detail-hero">
          {heroImage && (
            <div className="program-detail-hero-bg" aria-hidden="true">
              <Image src={heroImage} alt="" fill priority sizes="100vw" className="program-detail-hero-img" />
            </div>
          )}
          <div className="program-detail-hero-overlay" aria-hidden="true" />
          <div className="container program-detail-hero-inner">
            <h1 className="program-detail-title">{program.title_ko}</h1>
            {program.title_en && <p className="program-detail-title-en">{program.title_en}</p>}
            {program.summary_ko && <p className="program-detail-lede">{program.summary_ko}</p>}
            <a href="#apply" className="btn-ink-primary program-detail-apply-cta">
              <IntlObject keycode="programs.detail.applyCta" />
            </a>
          </div>
        </section>

        <section className="program-detail-body">
          <div className="container program-detail-grid">
            <div className="program-detail-content">
              {program.description_ko && (
                <div className="program-detail-description">
                  {program.description_ko.split('\n').map((para, i) =>
                    para.trim() ? <p key={i}>{para}</p> : null
                  )}
                </div>
              )}

              <SupplyList supplies={programSupplies} sets={programSupplySets} />

              {program.images.length > 0 && (
                <div className="program-detail-gallery">
                  <span className="dancheong-divider" aria-hidden="true" />
                  <ImageGallery images={program.images} locale="ko" />
                </div>
              )}
            </div>

            <aside className="program-detail-aside">
              <ShareQrCard title={program.title_ko} />
              <ProgramDetailFacts program={program} />
            </aside>
          </div>
        </section>

        <section className="program-apply" id="apply">
          <div className="container">
            <RegistrationForm
              programId={program.id}
              programType={program.program_type}
              programTitleKo={program.title_ko}
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
