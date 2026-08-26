/**
 * Program Detail Page
 * 수업·프로그램·캠프 상세.
 *
 * **신청 경로는 이 페이지에서 한 번만 정하고, 모든 버튼이 그 결정을 따른다.**
 * 히어로 CTA만 신청서를 보고 사이드바 CTA는 옛 모달을 열던 시절이 있었다 —
 * 글자도 스타일도 같은 버튼 두 개가 서로 다른 저장소로 신청을 떨어뜨렸고,
 * 실제로 한 사람이 5분 간격으로 양쪽에 두 번 낸 일이 있었다.
 * 그래서 판단은 getLinkedForm 하나로 모으고 applyMode 로 내려보낸다.
 */

import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
import ImageGallery from '@/components/gallery/ImageGallery';
import Link from 'next/link';
import { ApplyModalProvider, ApplyButton } from '@/components/classes/ApplyModal';
import ProgramDetailFacts from '@/components/classes/ProgramDetailFacts';
import ShareQrCard from '@/components/share/ShareQrCard';
import SupplyList from '@/components/supplies/SupplyList';
import { getProgramBySlug, incrementProgramViewCount, getProgramSupplies, getProgramSupplySets, getLinkedForm } from '@/lib/d1';
import { resolveApplyMode } from '@/lib/applyRoute';

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

  // 이 수업의 신청 경로를 여기서 한 번 정하고, 페이지의 모든 버튼이 이 결정을 따른다.
  // 규칙 자체는 lib/applyRoute 에 있다 — 서버(POST /api/applications)도 같은 걸 본다.
  const linkedForm = await getLinkedForm(program.active_form_id);
  const applyMode = resolveApplyMode(linkedForm);

  return (
    <>
      <Header />
      <ApplyModalProvider
        programId={program.id}
        programType={program.program_type}
        programTitleKo={program.title_ko}
        enabled={applyMode === 'legacy'}
      >
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
              {applyMode === 'form' && (
                <Link
                  href={`/f/${linkedForm!.slug}`}
                  className="btn-ink-primary program-detail-apply-cta"
                >
                  <IntlObject keycode="programs.detail.applyCta" />
                </Link>
              )}
              {applyMode === 'closed' && (
                <span className="program-detail-apply-cta is-closed" aria-disabled="true">
                  <IntlObject keycode="programs.detail.applyClosed" />
                </span>
              )}
              {applyMode === 'legacy' && (
                <ApplyButton className="btn-ink-primary program-detail-apply-cta">
                  <IntlObject keycode="programs.detail.applyCta" />
                </ApplyButton>
              )}
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
                <ProgramDetailFacts
                  program={program}
                  applyMode={applyMode}
                  formSlug={linkedForm?.slug ?? null}
                />
                <ShareQrCard title={program.title_ko} />
              </aside>
            </div>
          </section>
        </main>
      </ApplyModalProvider>
      <Footer />
    </>
  );
}
