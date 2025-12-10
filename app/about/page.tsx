'use client';

import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';

export default function About() {
  return (
    <>
      <Header />
      <main>
        {/* About Hero Section */}
        <section id="about-hero" className="about-hero">
          {/* Background Image - 텍스트 뒤에 배치 */}
          <div className="about-hero-bg">
            <Image
              src="/assets/images/about01.jpg"
              alt="부채춤 - Korean Fan Dance Performance"
              fill
              style={{ objectFit: 'cover', objectPosition: 'center top' }}
              priority
            />
          </div>

          <div className="about-hero-container">
            {/* Content Wrapper - 가운데 1/3 영역 */}
            <div className="about-hero-content-wrapper">
              {/* Title - Logo Image */}
              <h1 className="about-hero-title">
                <Image
                  src="/assets/logo/logo_long_fixed.png"
                  alt="Korean Traditional Dance of Choomnoori"
                  width={800}
                  height={200}
                  priority
                />
              </h1>

              {/* Korean Title */}
              <IntlObject
                keycode="about.hero.korean"
                returnType="h2"
                className="about-hero-korean"
              />

              {/* Founded */}
              <IntlObject
                keycode="about.hero.founded"
                returnType="p"
                className="about-hero-founded"
              />

              {/* Description */}
              <div className="about-hero-content">
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
              <div className="about-director-title">
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
              <div className="about-director-portrait">
                <Image
                  src="/assets/images/about03.png"
                  alt="안은희 단장 - Director Eunhee Ahn"
                  width={280}
                  height={350}
                  style={{ width: '100%', height: 'auto' }}
                />
              </div>

              {/* Bio */}
              <div className="about-director-bio">
                <IntlObject
                  keycode="about.director.bio1"
                  returnType="p"
                />
              </div>
            </div>

            {/* Right Column - Full Body Dance Photo */}
            <div className="about-director-right">
              <Image
                src="/assets/images/about04.png"
                alt="안은희 단장 한복 춤 - Director Eunhee Ahn in Hanbok"
                width={500}
                height={750}
                style={{ width: '100%', height: 'auto' }}
              />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
