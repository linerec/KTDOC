'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
import ImageObject from '@/components/common/ImageObject';
import ScrollReveal from '@/components/common/ScrollReveal';
import DirectorLivingPortrait from '@/components/about/DirectorLivingPortrait';
import StaffLivingPortrait from '@/components/about/StaffLivingPortrait';

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

              {/* 소개글 + 주요 초청공연 + 수상 — 한 덩어리 위지윅.
                  읽을 문장은 문단으로, 훑을 항목은 목록으로. 그 문법은 그대로다.
                  달라진 것은 **칸의 개수를 코드가 정하지 않는다**는 것이다.

                  예전에는 문단 3개와 목록 6줄이 여기 박혀 있었다. 칸이 모자라자
                  한 칸에 엔터로 여러 줄을 넣으셨는데, HTML은 줄바꿈을 공백으로 접는다
                  — 대사관 초청공연 세 건과 NBC TODAY Show가 한 줄로 이어져 나왔다.
                  칸에 줄을 나눠 넣었으니 나눠 보일 거라 믿는 것이 당연하고,
                  그 믿음이 깨지는 자리를 화면에서는 알아낼 수 없다.

                  이제 엔터가 곧 새 줄이다. 스타일은 아래 .about-director-profile 이
                  옛 블록(.about-director-bio/-block)과 같은 모양을 그대로 그린다. */}
              <IntlObject
                rich
                keycode="about.director.profile"
                className="about-director-profile reveal reveal--up"
                style={revealDelay(240)}
              />
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
              {/* 선생님 사진으로 만든 무음 루프. 단장 자리와 달리 웃는 이스터에그는 없다.
                  주의: 여기 영상은 리포지토리 파일이라 콘솔에서 사진을 바꿔도 따라오지 않는다
                  — 사진이 교체되면 영상도 다시 만들어 넣어야 한다
                  (소스와 잡: D:\ComfyUI\_h3\jobs\ktdoc-staff\). */}
              <div className="about-staff-portrait reveal reveal--up" style={revealDelay(120)}>
                <StaffLivingPortrait
                  name="baek"
                  alt="백수경 선생 - Soo Gyung Baek, Administrative Director & Instructor"
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
                <StaffLivingPortrait
                  name="han"
                  alt="한진선 선생 - Jinseon Han, Assistant Instructor"
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
