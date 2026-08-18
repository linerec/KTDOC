/**
 * Timeline Page
 * 춤누리 연혁 타임라인 — 연도별 공연·행사 기록을 세로 타임라인으로
 */

import type { Metadata } from 'next';
import { getEvents, allKindsChronological} from '@/lib/d1';
import EventTimeline from '@/components/timeline/EventTimeline';
import IntlObject from '@/components/common/IntlObject';

// 선언이 없으면 빌드 시점 스냅샷으로 정적 프리렌더돼 배포 전까지 새 이벤트가 안 보인다.
// 연혁은 실시간성이 필요 없으므로 홈과 같은 ISR 5분(D1 REST 왕복 3회를 캐시로 흡수).
export const revalidate = 300;

export const metadata: Metadata = {
  // 루트 레이아웃의 title 템플릿('%s | KTDOC')이 접미사를 붙인다
  title: 'Timeline',
  description:
    'The journey of Korean Traditional Dance of Choomnoori — performances and events through the years',
  alternates: {
    canonical: '/timeline',
  },
  openGraph: {
    title: 'Timeline | KTDOC',
    description:
      'The journey of Korean Traditional Dance of Choomnoori — performances and events through the years',
    url: '/timeline',
    images: [
      {
        url: '/og-image.jpg',
        width: 600,
        height: 400,
        alt: 'KTDOC - Korean Traditional Dance of Choomnoori',
      },
    ],
  },
};

export default async function TimelinePage() {
  const { events } = await getEvents(allKindsChronological());

  return (
    <main className="timeline-page">
      {/* Hero Section */}
      <section className="timeline-hero">
        <div className="container">
          <IntlObject keycode="pages.timeline.eyebrow" className="timeline-hero-label" />
          <IntlObject
            keycode="pages.timeline.title"
            returnType="h1"
            className="timeline-hero-title"
          />
          <IntlObject
            keycode="pages.timeline.description"
            returnType="p"
            className="timeline-hero-description"
          />
        </div>
      </section>

      {/* Timeline Content */}
      <section className="timeline-main">
        <div className="container">
          <EventTimeline events={events} />
        </div>
      </section>
    </main>
  );
}
