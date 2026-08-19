/**
 * 형제자매 등록 안내 — /guide/siblings
 *
 * 자녀가 여럿인 학부모를 위한 한 장짜리 가이드. 링크·QR로 학부모에게 직접
 * 전하는 자리라(카톡 공유가 배포 경로) 스텝 3개 + 실제 화면 스크린샷으로
 * 최대한 쉽게 쓴다. 스크린샷은 public/assets/images/guide/ 의 정적 파일.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
import ContactChannels from '@/components/common/ContactChannels';

export const metadata: Metadata = {
  title: '형제자매 등록 안내',
  description:
    '자녀가 두 명 이상인 학부모를 위한 안내 — 학부모 계정 하나로 아이들 모두의 수업·공연을 관리하는 방법.',
  alternates: { canonical: '/guide/siblings' },
  openGraph: {
    title: '형제자매 등록 안내 | KTDOC',
    description: '학부모 계정 하나로 아이들 모두의 수업·공연을 관리하세요.',
    url: '/guide/siblings',
  },
};

export default function SiblingGuidePage() {
  return (
    <>
      <Header />
      <main className="sibguide-page">
        <section className="sibguide-hero">
          <div className="container sibguide-hero-inner">
            <p className="sibguide-eyebrow">
              <IntlObject keycode="pages.sibguide.eyebrow" />
            </p>
            <IntlObject keycode="pages.sibguide.title" returnType="h1" className="sibguide-title" />
            <IntlObject keycode="pages.sibguide.desc" returnType="p" className="sibguide-desc" />
          </div>
        </section>

        <section className="sibguide-body">
          <div className="container sibguide-inner">
            {/* 1단계 — 가입 시 자녀 모두 입력 */}
            <article className="sibguide-step">
              <div className="sibguide-step-head">
                <span className="sibguide-step-num" aria-hidden="true">1</span>
                <h2 className="sibguide-step-title">
                  <IntlObject keycode="pages.sibguide.step1.title" />
                </h2>
              </div>
              <IntlObject keycode="pages.sibguide.step1.body" returnType="p" className="sibguide-step-body" />
              <figure className="sibguide-shot sibguide-shot-narrow">
                <Image
                  src="/assets/images/guide/signup-children.png"
                  alt=""
                  width={319}
                  height={721}
                />
                <figcaption>
                  <IntlObject keycode="pages.sibguide.step1.caption" />
                </figcaption>
              </figure>
            </article>

            {/* 2단계 — 가입 후 프로필에서 자녀 추가 */}
            <article className="sibguide-step">
              <div className="sibguide-step-head">
                <span className="sibguide-step-num" aria-hidden="true">2</span>
                <h2 className="sibguide-step-title">
                  <IntlObject keycode="pages.sibguide.step2.title" />
                </h2>
              </div>
              <IntlObject keycode="pages.sibguide.step2.body" returnType="p" className="sibguide-step-body" />
              <figure className="sibguide-shot">
                <Image
                  src="/assets/images/guide/profile-children.png"
                  alt=""
                  width={520}
                  height={266}
                />
                <figcaption>
                  <IntlObject keycode="pages.sibguide.step2.caption" />
                </figcaption>
              </figure>
            </article>

            {/* 3단계 — 연결 후 가능한 것들 */}
            <article className="sibguide-step">
              <div className="sibguide-step-head">
                <span className="sibguide-step-num" aria-hidden="true">3</span>
                <h2 className="sibguide-step-title">
                  <IntlObject keycode="pages.sibguide.step3.title" />
                </h2>
              </div>
              <IntlObject keycode="pages.sibguide.step3.body" returnType="p" className="sibguide-step-body" />

              <div className="sibguide-feats">
                <div className="sibguide-feat">
                  <h3 className="sibguide-feat-title">
                    <IntlObject keycode="pages.sibguide.feat.classes.title" />
                  </h3>
                  <IntlObject keycode="pages.sibguide.feat.classes.body" returnType="p" className="sibguide-feat-body" />
                  <figure className="sibguide-shot">
                    <Image
                      src="/assets/images/guide/my-classes.png"
                      alt=""
                      width={688}
                      height={174}
                    />
                  </figure>
                </div>
                <div className="sibguide-feat">
                  <h3 className="sibguide-feat-title">
                    <IntlObject keycode="pages.sibguide.feat.checkin.title" />
                  </h3>
                  <IntlObject keycode="pages.sibguide.feat.checkin.body" returnType="p" className="sibguide-feat-body" />
                  <figure className="sibguide-shot">
                    <Image
                      src="/assets/images/guide/parent-checkin.png"
                      alt=""
                      width={673}
                      height={114}
                    />
                  </figure>
                </div>
                <div className="sibguide-feat">
                  <h3 className="sibguide-feat-title">
                    <IntlObject keycode="pages.sibguide.feat.forms.title" />
                  </h3>
                  <IntlObject keycode="pages.sibguide.feat.forms.body" returnType="p" className="sibguide-feat-body" />
                  <figure className="sibguide-shot">
                    <Image
                      src="/assets/images/guide/form-child-select.png"
                      alt=""
                      width={720}
                      height={82}
                    />
                  </figure>
                </div>
                <div className="sibguide-feat">
                  <h3 className="sibguide-feat-title">
                    <IntlObject keycode="pages.sibguide.feat.calendar.title" />
                  </h3>
                  <IntlObject keycode="pages.sibguide.feat.calendar.body" returnType="p" className="sibguide-feat-body" />
                </div>
              </div>
            </article>

            {/* 자주 묻는 질문 */}
            <section className="sibguide-faq">
              <h2 className="sibguide-faq-title">
                <IntlObject keycode="pages.sibguide.faq.title" />
              </h2>
              <dl className="sibguide-faq-list">
                <div className="sibguide-faq-item">
                  <dt><IntlObject keycode="pages.sibguide.faq1.q" /></dt>
                  <dd><IntlObject keycode="pages.sibguide.faq1.a" /></dd>
                </div>
                <div className="sibguide-faq-item">
                  <dt><IntlObject keycode="pages.sibguide.faq2.q" /></dt>
                  <dd><IntlObject keycode="pages.sibguide.faq2.a" /></dd>
                </div>
                <div className="sibguide-faq-item">
                  <dt><IntlObject keycode="pages.sibguide.faq3.q" /></dt>
                  <dd><IntlObject keycode="pages.sibguide.faq3.a" /></dd>
                </div>
              </dl>
            </section>

            {/* 시작하기 */}
            <section className="sibguide-cta">
              <IntlObject keycode="pages.sibguide.cta.lead" returnType="p" className="sibguide-cta-lead" />
              <div className="sibguide-cta-actions">
                <Link href="/register" className="sibguide-btn sibguide-btn-primary">
                  <IntlObject keycode="pages.sibguide.cta.signup" />
                </Link>
                <Link href="/admin/profile" className="sibguide-btn">
                  <IntlObject keycode="pages.sibguide.cta.profile" />
                </Link>
              </div>
              <IntlObject keycode="pages.sibguide.contact" returnType="p" className="sibguide-contact-lead" />
              <ContactChannels className="contact-channels--sibguide" />
            </section>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
