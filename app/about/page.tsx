/**
 * About — 단체 소개 페이지.
 *
 * 4월 요구사항 문서(docs/요구사항-초안.md 6절)에서 합의한 구성을 채운다:
 * 단체 소개 → 원장 → 강사 → 연혁 → (위치·연락처는 아직).
 * 본문 원문은 docs/content/choomnoori/ 의 수신 자료에서 왔다.
 *
 * 연혁 요약만 D1 을 읽으므로 이 페이지는 서버 컴포넌트다. 화면 조각들은
 * 각자 'use client' 를 달고 있다.
 */

import type { CSSProperties } from 'react';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
import ImageObject from '@/components/common/ImageObject';
import ScrollReveal from '@/components/common/ScrollReveal';
import AboutPerson from '@/components/about/AboutPerson';
import AboutChronicle from '@/components/about/AboutChronicle';
import { getEvents, chronicleHighlights } from '@/lib/d1';

// 스태거 딜레이를 CSS 변수로 전달하는 헬퍼
const revealDelay = (ms: number): CSSProperties => ({ '--reveal-delay': `${ms}ms` } as CSSProperties);

export default async function About() {
  const { events: highlights } = await getEvents(chronicleHighlights());

  return (
    <>
      <Header />
      <ScrollReveal />
      <main>
        {/* About Hero Section */}
        <section id="about-hero" className="about-hero">
          {/* Background Image - 텍스트 뒤에 배치 */}
          <div className="about-hero-bg">
            <ImageObject
              keycode="image.about.hero"
              fill
              sizes="100vw"
              priority
              className="about-hero-bg-img"
              containerClassName="about-hero-bg-fill"
              fallbackSrc="/assets/images/site/times-square-drums.jpg"
              alt="춤누리 타임스퀘어 공연 - Choomnoori Times Square Performance"
              imageStyle={{ objectFit: 'cover', objectPosition: '20% 56%' }}
            />
          </div>

          <div className="about-hero-container">
            {/* Content Wrapper - 가운데 1/3 영역 */}
            <div className="about-hero-content-wrapper">
              {/* Title - Logo Image */}
              <h1 className="about-hero-title reveal reveal--up">
                <Image
                  src="/assets/logo/logo_white.png"
                  alt="Korean Traditional Dance of Choomnoori"
                  width={400}
                  height={242}
                  priority
                />
              </h1>

              {/* Korean Title */}
              <IntlObject
                keycode="about.hero.korean"
                returnType="h2"
                className="about-hero-korean reveal reveal--up"
                style={revealDelay(140)}
              />

              {/* Founded */}
              <IntlObject
                keycode="about.hero.founded"
                returnType="p"
                className="about-hero-founded reveal reveal--up"
                style={revealDelay(220)}
              />

              {/* Description */}
              <div className="about-hero-content reveal reveal--up" style={revealDelay(300)}>
                <IntlObject
                  keycode="about.hero.description1"
                  returnType="p"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 단체 소개 — 4월 요구사항 문서의 첫 섹션. 미션(5/22)과 재단 소개(8/6)에서 왔다. */}
        <section id="about-org" className="about-org">
          <div className="container about-org-inner">
            <IntlObject keycode="about.org.eyebrow" className="about-section-eyebrow reveal reveal--up" />
            <IntlObject
              keycode="about.org.title"
              returnType="h2"
              className="about-section-title reveal reveal--up"
              style={revealDelay(80)}
            />
            <div className="about-org-body reveal reveal--up" style={revealDelay(160)}>
              <IntlObject keycode="about.org.body1" returnType="p" />
              <IntlObject keycode="about.org.body2" returnType="p" />
            </div>

            {/* 재단은 한 단락까지만. 501(c)(3)는 '정식 등록된 곳'이라는 신호라 빼지 않는다. */}
            <aside className="about-foundation reveal reveal--up" style={revealDelay(240)}>
              <IntlObject keycode="about.org.foundationLabel" returnType="h3" className="about-foundation-label" />
              <IntlObject keycode="about.org.foundationName" returnType="p" className="about-foundation-name" />
              <IntlObject keycode="about.org.foundationBody" returnType="p" className="about-foundation-body" />
            </aside>
          </div>
        </section>

        {/* 인물 — 원장이 크게, 강사가 한 단계 작게. 골격은 같다(AboutPerson 참고). */}
        <section id="about-people" className="about-people">
          <div className="container">
            <AboutPerson
              prefix="about.director"
              imageKeycode="image.about.director.portrait"
              imageFallback="/assets/images/director_portrait.jpg"
              imageAlt="안은희 단장 - Director Eunhee Ahn"
              scale="lead"
              nameKey="about.director.name"
              roleKey="about.director.role"
            />
            <AboutPerson
              prefix="about.instructor"
              imageKeycode="image.about.instructor.portrait"
              imageFallback="/assets/images/instructor_baek.jpg"
              imageAlt="백수경 행정디렉터·강사 - Soo Gyung Baek, Administrative Director & Instructor"
              scale="support"
              nameKey="about.instructor.name"
              roleKey="about.instructor.role"
            />
          </div>
        </section>

        {/* 연혁 요약 — 전체 83건은 /timeline 이 맡는다 */}
        <section id="about-chronicle" className="about-chronicle">
          <div className="container about-chronicle-inner">
            <IntlObject keycode="about.chronicle.eyebrow" className="about-section-eyebrow reveal reveal--up" />
            <IntlObject
              keycode="about.chronicle.title"
              returnType="h2"
              className="about-section-title reveal reveal--up"
              style={revealDelay(80)}
            />
            <IntlObject
              keycode="about.chronicle.description"
              returnType="p"
              className="about-section-lede reveal reveal--up"
              style={revealDelay(140)}
            />
            <AboutChronicle events={highlights} />
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
