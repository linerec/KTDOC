/**
 * RecentJourney — 홈 "최근 발자취"
 *
 * 지난 공개 행사 3건을 최신순으로 보여주고 타임라인으로 잇는다.
 * 공연과 학내 행사를 섞는다 — 섞여야 "계속 활동하고 있다"가 읽힌다.
 *
 * 광고가 아니라 기록이다: 홍보 카피·CTA·신청 유도 없이 날짜·종류·제목만 둔다.
 * 표시할 기록이 없으면 섹션 자체를 렌더하지 않는다.
 */

import Link from 'next/link';
import { getRecentPastEvents } from '@/lib/d1';
import IntlObject from '@/components/common/IntlObject';
import ScrollReveal from '@/components/common/ScrollReveal';
import RecentJourneyCard from './RecentJourneyCard';

export default async function RecentJourney() {
  const events = await getRecentPastEvents(3);
  if (events.length === 0) return null;

  return (
    <section className="journey-section" aria-labelledby="journey-title">
      <div className="container">
        <div className="journey-head">
          <IntlObject keycode="home.journey.eyebrow" className="journey-eyebrow" />
          <h2 id="journey-title" className="journey-title">
            <IntlObject keycode="home.journey.title" />
          </h2>
        </div>

        <div className="journey-grid">
          {events.map((event, i) => (
            <RecentJourneyCard key={event.id} event={event} index={i} />
          ))}
        </div>

        <Link href="/timeline" className="journey-more">
          <IntlObject keycode="home.journey.more" />
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      {/* .reveal 요소를 관찰하는 옵저버 — 형제로 한 번 배치한다 */}
      <ScrollReveal />
    </section>
  );
}
