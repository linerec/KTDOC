'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
import ImageObject from '@/components/common/ImageObject';
import ScrollReveal from '@/components/common/ScrollReveal';
import DirectorLivingPortrait from '@/components/about/DirectorLivingPortrait';

// 스태거 딜레이를 CSS 변수로 전달하는 헬퍼
const revealDelay = (ms: number): CSSProperties => ({ '--reveal-delay': `${ms}ms` } as CSSProperties);

export default function About() {
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
              /* 지난 사진이 아니라 지금 쓰는 히어로 사진이다 — 콘솔 업로드 대신
                 리포지토리에 담겨 있을 뿐이라 그대로 그린다.
                 나중에 콘솔에서 교체하시면 이 줄을 null 로 바꿀 것. */
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

        {/* Director Section */}
        <section id="about-director" className="about-director">
          <div className="about-director-container">
            {/* Left Column - Title, Portrait, Bio */}
            <div className="about-director-left">
              {/* Title */}
              <div className="about-director-title reveal reveal--up">
                <IntlObject
                  keycode="about.director.title.ko"
                  returnType="h2"
                  className="about-director-title-ko"
                />
                <IntlObject
                  keycode="about.director.title.en"
                  returnType="p"
                  className="about-director-title-en"
                />
              </div>

              {/* Portrait — 원장님 사진으로 만든 무음 루프. 마우스를 올리거나 짚으면 웃으신다. */}
              <div className="about-director-portrait reveal reveal--up" style={revealDelay(140)}>
                <DirectorLivingPortrait alt="안은희 단장 - Director Eunhee Ahn" />
              </div>

              {/* Bio — 문단 셋에 이어 무대·수상 목록. 선생님 카드(약력 + 주요 경력)와
                  같은 문법을 쓴다: 읽을 문장은 문단으로, 훑을 항목은 목록으로.
                  한 덩어리 긴 문단은 카네기홀·UN 같은 이름을 문장 속에 묻어 버린다. */}
              <div className="about-director-bio reveal reveal--up" style={revealDelay(240)}>
                <IntlObject keycode="about.director.bio.1" returnType="p" />
                <IntlObject keycode="about.director.bio.2" returnType="p" />
                <IntlObject keycode="about.director.bio.3" returnType="p" />
              </div>

              <div className="about-director-credits reveal reveal--up" style={revealDelay(300)}>
                <div className="about-director-block">
                  <IntlObject
                    keycode="about.director.stages.title"
                    returnType="p"
                    className="about-director-block-title"
                  />
                  <IntlObject
                    keycode="about.director.stages.lead"
                    returnType="p"
                    className="about-director-block-lead"
                  />
                  <ul>
                    <li><IntlObject keycode="about.director.stages.1" /></li>
                    <li><IntlObject keycode="about.director.stages.2" /></li>
                    <li><IntlObject keycode="about.director.stages.3" /></li>
                    <li><IntlObject keycode="about.director.stages.4" /></li>
                    <li><IntlObject keycode="about.director.stages.5" /></li>
                    <li><IntlObject keycode="about.director.stages.6" /></li>
                  </ul>
                </div>

                <div className="about-director-block">
                  <IntlObject
                    keycode="about.director.awards.title"
                    returnType="p"
                    className="about-director-block-title"
                  />
                  <ul>
                    <li><IntlObject keycode="about.director.awards.1" /></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right Column - Full Body Dance Photo */}
            <div className="about-director-right reveal reveal--blur" style={revealDelay(60)}>
              <ImageObject
                keycode="image.about.director.full"
                width={500}
                height={750}
                className="about-director-right-img"
                containerClassName="about-director-right-fill"
                /* 폴백 없음 — 이미지가 안 뜨면 빈 자리로 둔다. 옛 사진이 대신
                   올라오는 편이 더 위험하다(원장님이 콘솔에서 교체하신 사진이다). */
                fallbackSrc={null}
                alt="안은희 단장 한복 춤 - Director Eunhee Ahn in Hanbok"
                imageStyle={{ width: '100%', height: 'auto' }}
              />
            </div>
          </div>
        </section>

        {/* Staff Section - 함께하는 선생님들 */}
        <section id="about-staff" className="about-staff">
          <div className="about-staff-container">
            <IntlObject
              keycode="about.staff.heading"
              returnType="h2"
              className="about-staff-heading reveal reveal--up"
            />

            <article className="about-staff-card">
              <div className="about-staff-portrait reveal reveal--up" style={revealDelay(120)}>
                <ImageObject
                  keycode="image.about.staff.baek.portrait"
                  width={752}
                  height={940}
                  className="about-staff-portrait-img"
                  containerClassName="about-staff-portrait-fill"
                  fallbackSrc={null}
                  alt="백수경 선생 - Soo Gyung Baek, Administrative Director & Instructor"
                  imageStyle={{ width: '100%', height: 'auto' }}
                />
              </div>

              <div className="about-staff-info reveal reveal--up" style={revealDelay(200)}>
                <div className="about-staff-title">
                  <IntlObject
                    keycode="about.staff.baek.name"
                    returnType="h3"
                    className="about-staff-name"
                  />
                  <IntlObject
                    keycode="about.staff.baek.role"
                    returnType="p"
                    className="about-staff-role"
                  />
                </div>

                <div className="about-staff-bio">
                  <IntlObject keycode="about.staff.baek.bio1" returnType="p" />
                  <IntlObject keycode="about.staff.baek.bio2" returnType="p" />
                </div>

                <div className="about-staff-career">
                  <IntlObject
                    keycode="about.staff.baek.career.title"
                    returnType="p"
                    className="about-staff-career-title"
                  />
                  <ul>
                    <li><IntlObject keycode="about.staff.baek.career.1" /></li>
                    <li><IntlObject keycode="about.staff.baek.career.2" /></li>
                    <li><IntlObject keycode="about.staff.baek.career.3" /></li>
                    <li><IntlObject keycode="about.staff.baek.career.4" /></li>
                    <li><IntlObject keycode="about.staff.baek.career.5" /></li>
                  </ul>
                </div>
              </div>
            </article>

            <article className="about-staff-card">
              <div className="about-staff-portrait reveal reveal--up" style={revealDelay(120)}>
                <ImageObject
                  keycode="image.about.staff.han.portrait"
                  width={752}
                  height={940}
                  className="about-staff-portrait-img"
                  containerClassName="about-staff-portrait-fill"
                  /* 지난 사진이 아니라 지금 쓰는 사진이다 — 콘솔 업로드 대신
                     리포지토리에 담겨 있을 뿐이라 그대로 그린다.
                     나중에 콘솔에서 교체하시면 이 줄을 null 로 바꿀 것. */
                  fallbackSrc="/assets/images/staff_han_portrait.jpg"
                  alt="한진선 선생 - Jinseon Han, Assistant Instructor"
                  imageStyle={{ width: '100%', height: 'auto' }}
                />
              </div>

              <div className="about-staff-info reveal reveal--up" style={revealDelay(200)}>
                <div className="about-staff-title">
                  <IntlObject
                    keycode="about.staff.han.name"
                    returnType="h3"
                    className="about-staff-name"
                  />
                  <IntlObject
                    keycode="about.staff.han.role"
                    returnType="p"
                    className="about-staff-role"
                  />
                </div>

                <div className="about-staff-bio">
                  <IntlObject keycode="about.staff.han.bio1" returnType="p" />
                  <IntlObject keycode="about.staff.han.bio2" returnType="p" />
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
