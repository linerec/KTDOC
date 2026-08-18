'use client';

/**
 * 소개 페이지의 연혁 요약.
 *
 * 전체 연혁은 83건이라 여기에 다 쏟으면 아무도 읽지 않는다. 대표 항목만 골라
 * 연도별로 묶어 보여주고, 전체는 /timeline 으로 넘긴다.
 * 고르는 일은 화면이 아니라 데이터가 한다 — lib/d1/eventViews.ts 의
 * chronicleHighlights(is_featured)이고, 운영자가 관리 콘솔에서 바꿀 수 있다.
 */

import Link from 'next/link';
import type { EventWithCategory } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';
import { useT } from '@/lib/i18n/useT';
import { sortChronicle } from '@/lib/events/chronicle';

interface AboutChronicleProps {
  events: EventWithCategory[];
}

export default function AboutChronicle({ events }: AboutChronicleProps) {
  const { locale } = useLanguage();
  const t = useT();

  if (events.length === 0) return null;

  // 연도별로 묶는다. 오래된 해가 위로 — 설립부터 읽어 내려가야 '쌓였다'가 전달된다.
  const byYear = new Map<number, EventWithCategory[]>();
  for (const event of events) {
    const list = byYear.get(event.year) || [];
    list.push(event);
    byYear.set(event.year, list);
  }
  // 연도 안에서는 원문 순서를 지킨다 — 날짜가 모두 1월 1일이라 그냥 두면 뒤집힌다
  const years = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, list]) => [year, sortChronicle(list)] as const);

  return (
    <ol className="about-chronicle-list">
      {years.map(([year, list]) => (
        <li className="about-chronicle-row" key={year}>
          <span className="about-chronicle-year">{year}</span>
          <span className="about-chronicle-items">
            {list.map((event) => (
              <span className="about-chronicle-item" key={event.id}>
                {locale === 'ko' ? event.title_ko : event.title_en || event.title_ko}
              </span>
            ))}
          </span>
        </li>
      ))}
      <li className="about-chronicle-more">
        <Link href="/timeline" className="about-chronicle-more-link">
          {t('about.chronicle.more', '전체 연대표 보기')} →
        </Link>
      </li>
    </ol>
  );
}
