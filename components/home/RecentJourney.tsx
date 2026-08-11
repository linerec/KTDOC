/**
 * RecentJourney — 홈 "오늘의 무대" + "최근의 기록"
 *
 * 두 블록을 한 컴포넌트가 그린다. 같은 질문("요즘 뭐 하고 있나")에 답하는 자리라
 * 붙어 있어야 하고, 오늘 것을 기록에서 빼야 하므로 판단이 한곳에 있어야 한다.
 *
 *  - 오늘 열리는 공개 행사가 있으면 → TodayStage로 크게 세운다
 *  - 그 아래로 지난 공개 행사 3건 → 타임라인 카드
 * 공연과 학내 행사를 섞는다 — 섞여야 "계속 활동하고 있다"가 읽힌다.
 *
 * 기록 쪽은 광고가 아니라 기록이다: 홍보 카피·CTA 없이 날짜·종류·제목만 둔다.
 * 오늘 것은 다르다 — 오늘 가 볼 수 있는 자리이므로 시각·장소·링크를 준다.
 *
 * '오늘'은 학원 시간대로 판단한다(lib/siteDay.ts). 서버는 UTC라 그냥 두면
 * 행사 당일 저녁에 배너가 사라진다.
 */

import Link from 'next/link';
import { getRecentPastEvents, getPublishedEventsOnDay } from '@/lib/d1';
import { getCalendarConfig } from '@/lib/calendar';
import { dayInTimeZone } from '@/lib/siteDay';
import IntlObject from '@/components/common/IntlObject';
import ScrollReveal from '@/components/common/ScrollReveal';
import RecentJourneyCard from './RecentJourneyCard';
import TodayStage from './TodayStage';

export default async function RecentJourney() {
  // 시간대의 단일 출처는 캘린더 설정 — .ics 피드가 시각을 해석하는 기준과 같아야 한다.
  const { timezone } = await getCalendarConfig();
  const today = dayInTimeZone(new Date(), timezone);

  const [todayEvents, pastEvents] = await Promise.all([
    getPublishedEventsOnDay(today).catch(() => []),
    getRecentPastEvents(3, today).catch(() => []),
  ]);

  if (todayEvents.length === 0 && pastEvents.length === 0) return null;

  return (
    <>
      <TodayStage events={todayEvents} />

      {pastEvents.length > 0 && (
        <section className="journey-section" aria-labelledby="journey-title">
          <div className="container">
            <div className="journey-head">
              <IntlObject keycode="home.journey.eyebrow" className="journey-eyebrow" />
              <h2 id="journey-title" className="journey-title">
                <IntlObject keycode="home.journey.title" />
              </h2>
            </div>

            <div className="journey-grid">
              {pastEvents.map((event, i) => (
                <RecentJourneyCard key={event.id} event={event} index={i} />
              ))}
            </div>

            <Link href="/timeline" className="journey-more">
              <IntlObject keycode="home.journey.more" />
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        </section>
      )}

      {/* .reveal 요소를 관찰하는 옵저버 — 형제로 한 번 배치한다 */}
      <ScrollReveal />
    </>
  );
}
