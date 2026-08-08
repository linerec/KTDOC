'use client';

/**
 * EventDetailFacts — 공연·행사 상세의 사이드바 정보 카드
 *
 * 수업 상세의 ProgramDetailFacts와 같은 결이다. "언제·어디서·얼마나"를 한 덩어리로
 * 묶고, 그 아래 '내 캘린더에 추가'를 둔다. 예전에는 이 정보들이 헤더에 흩어져 있고
 * 캘린더 버튼이 제목 바로 밑에 붙어 있어, 본문을 읽다가 일정을 다시 확인하려면
 * 화면 맨 위로 올라가야 했다.
 */

import { useLanguage } from '@/contexts/LanguageContext';
import { useT } from '@/lib/i18n/useT';

interface EventDetailFactsProps {
  /** 표시용 날짜(이미 로케일에 맞게 포맷된 문자열) */
  date: string;
  /** 시간 범위. 집합 시간은 출연자용 내부 정보라 여기 오지 않는다. */
  time?: string | null;
  location?: string | null;
  address?: string | null;
  /** 학내 행사에 한해 참여 인원. 이름은 노출하지 않는다(미성년자 개인정보). */
  participantCount?: number;
  /** 기기(.ics) 구독 링크 */
  icsUrl: string;
  /** 구글 캘린더 링크 */
  googleUrl: string;
}

export default function EventDetailFacts({
  date,
  time,
  location,
  address,
  participantCount = 0,
  icsUrl,
  googleUrl,
}: EventDetailFactsProps) {
  const { locale } = useLanguage();
  const t = useT();
  const isKo = locale === 'ko';

  const facts: { label: string; value: string }[] = [];
  facts.push({
    label: t('gallery.detail.when', '일시'),
    value: time ? `${date} · ${time}` : date,
  });
  if (location) {
    facts.push({
      label: t('gallery.detail.venue', '장소'),
      value: address ? `${location}\n${address}` : location,
    });
  }
  if (participantCount > 0) {
    facts.push({
      label: t('gallery.detail.participants', '참여'),
      value: isKo ? `${participantCount}명` : `${participantCount} people`,
    });
  }

  return (
    <div className="event-facts-card">
      <dl className="event-facts-list">
        {facts.map((f) => (
          <div className="event-facts-row" key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="event-facts-cal">
        <a className="event-cal-btn event-cal-btn--primary" href={icsUrl}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
          {t('pages.calendar.sub.addDevice', '기기 캘린더에 추가')}
        </a>
        <a
          className="event-cal-btn"
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('pages.calendar.sub.addGoogle', '구글 캘린더에 추가')}
        </a>
      </div>
    </div>
  );
}
