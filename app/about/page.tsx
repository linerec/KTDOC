'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
import ImageObject from '@/components/common/ImageObject';
import ScrollReveal from '@/components/common/ScrollReveal';

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

              {/* Portrait */}
              <div className="about-director-portrait reveal reveal--up" style={revealDelay(140)}>
                <ImageObject
                  keycode="image.about.director.portrait"
                  width={752}
                  height={922}
                  className="about-director-portrait-img"
                  containerClassName="about-director-portrait-fill"
                  fallbackSrc="/assets/images/director_portrait.jpg"
                  alt="안은희 단장 - Director Eunhee Ahn"
                  imageStyle={{ width: '100%', height: 'auto' }}
                />
              </div>

              {/* Bio */}
              <div className="about-director-bio reveal reveal--up" style={revealDelay(240)}>
                <IntlObject
                  keycode="about.director.bio1"
                  returnType="p"
                />
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
                fallbackSrc="/assets/images/about04.png"
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
                  fallbackSrc="/assets/images/staff_baek_portrait.jpg"
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
