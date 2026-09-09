/**
 * Performances Page
 * 공연 쇼케이스 — 표준 히어로 + 대표 공연(is_signature) 시네마틱 배너 + 카테고리별 레퍼토리.
 * 대표 공연이 지정되지 않았으면 최근 공개 공연 그리드로 폴백(배너 없음). 정식 상세/연도 기록은 /gallery.
 */

import type { Metadata } from 'next';
import PerformancesHero from '@/components/performances/PerformancesHero';
import PerformanceHero from '@/components/performances/PerformanceHero';
import RepertoireSection from '@/components/performances/RepertoireSection';
import ArchiveBridge from '@/components/performances/ArchiveBridge';
import { Suspense } from 'react';
import { getEvents, publicPerformances } from '@/lib/d1';
import { parseListSort } from '@/lib/listSort';
import ListSortSelect from '@/components/common/ListSortSelect';
import type { EventWithCategory } from '@/types/gallery';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  // 루트 레이아웃의 title 템플릿('%s | KTDOC')이 접미사를 붙인다
  title: '공연',
  description:
    '춤누리 한국전통무용단의 대표 공연. 전통무용, 타악, K-Drum Ensemble로 구성된 무대를 소개합니다.',
  alternates: { canonical: '/performances' },
  openGraph: {
    title: '공연 | KTDOC',
    description: '춤누리 한국전통무용단의 대표 공연 쇼케이스',
    url: '/performances',
  },
};

interface CategoryGroup {
  slug: string;
  categoryKo: string;
  categoryEn: string;
  events: EventWithCategory[];
}

function groupByCategory(events: EventWithCategory[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const event of events) {
    const slug = event.category_slug || 'other';
    const existing = groups.get(slug);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(slug, {
        slug,
        categoryKo: event.category_name_ko || '기타',
        categoryEn: event.category_name_en || 'Other',
        events: [event],
      });
    }
  }
  return Array.from(groups.values());
}

interface PageProps {
  searchParams: Promise<{ sort?: string | string[] }>;
}

export default async function PerformancesPage({ searchParams }: PageProps) {
  // 정렬은 방문자가 고른다(개최일순 기본 / 등록순). /classes와 같은 장치.
  // 등록순이면 배너(첫 공연)도 가장 최근에 올린 공연이 된다.
  const sort = parseListSort((await searchParams).sort);

  // 큐레이션된 대표 공연 우선, 없으면 최근 공개 공연으로 폴백.
  // 학내 행사(kind='school')는 레퍼토리가 아니므로 두 경로 모두에서 제외한다.
  const showcase = await getEvents(publicPerformances({ showcase: true, sort }));
  const curated = showcase.events.length > 0;
  let events = showcase.events;
  if (!curated) {
    const fallback = await getEvents(publicPerformances({ limit: 12, sort }));
    events = fallback.events;
  }

  // 시네마틱 배너는 큐레이션된 대표 공연이 있을 때만 — 폴백(미큐레이션) 데이터는 크게 노출하지 않는다
  const featured = curated ? events[0] : null;
  const restGroups = groupByCategory(curated ? events.slice(1) : events);

  return (
    <main className="performances-page">
      <PerformancesHero />

      {featured && <PerformanceHero event={featured} />}

      {restGroups.length > 0 && (
        <section className="performances-main">
          <div className="container">
            <Suspense fallback={null}>
              <ListSortSelect />
            </Suspense>
            {restGroups.map((group) => (
              <RepertoireSection
                key={group.slug}
                categoryKo={group.categoryKo}
                categoryEn={group.categoryEn}
                events={group.events}
              />
            ))}
          </div>
        </section>
      )}

      <ArchiveBridge />
    </main>
  );
}
