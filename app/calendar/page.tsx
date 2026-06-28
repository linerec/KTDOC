/**
 * 캘린더 구독 안내 페이지 — /calendar
 * 원생·선생님이 학원 일정을 자신의 기기 캘린더에 구독하도록 안내한다.
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
import CalendarSubscribe from '@/components/CalendarSubscribe';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '일정 구독 | KTDOC',
  description:
    '춤누리 한국전통무용학원의 공연·행사·캠프 일정을 애플·구글·아웃룩 캘린더에 구독하세요. 일정이 추가·변경되면 자동으로 반영됩니다.',
  alternates: { canonical: '/calendar' },
  openGraph: {
    title: '일정 구독 | KTDOC',
    description: '학원 일정을 내 기기 캘린더에 구독하고 항상 최신으로 받아보세요.',
    url: '/calendar',
  },
};

async function resolveFeedUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'ktdoc.org';
  const proto = h.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}/calendar.ics`;
}

export default async function CalendarPage() {
  const feedUrl = await resolveFeedUrl();

  return (
    <>
      <Header />
      <main className="calendar-page">
        <section className="calendar-hero">
          <div className="container calendar-hero-inner">
            <p className="calendar-hero-eyebrow">
              <IntlObject keycode="pages.calendar.eyebrow" />
            </p>
            <IntlObject keycode="pages.calendar.title" returnType="h1" className="calendar-hero-title" />
            <IntlObject keycode="pages.calendar.description" returnType="p" className="calendar-hero-desc" />
          </div>
        </section>

        <section className="calendar-subscribe-section">
          <div className="container">
            <CalendarSubscribe feedUrl={feedUrl} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
