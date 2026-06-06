'use client';

/**
 * CampSpotlight
 * 수업 페이지 최상단 여름 캠프 스포트라이트. 대표(is_featured)로 지정된 캠프를 영화적으로 강조.
 * 모집 신호(signal)는 서버에서 계산해 prop으로 전달(하이드레이션 안정).
 * 대표 이미지가 없으면 먹빛 폴백으로 렌더(깨진 이미지 금지).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import IntlObject from '@/components/common/IntlObject';
import { getEnrollmentSignal } from '@/types/programs';
import type { ProgramWithMeta, EnrollmentSignal } from '@/types/programs';

interface CampSpotlightProps {
  camp: ProgramWithMeta;
}

function formatRange(start: string | null, end: string | null, isKo: boolean): string | null {
  if (!start) return null;
  const fmt = (s: string) => {
    const d = new Date(s + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return s;
    return isKo
      ? `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  if (end && end !== start) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start);
}

const SIGNAL_KEY: Record<NonNullable<EnrollmentSignal>, string> = {
  enrolling: 'pages.classes.camp.enrolling',
  closingSoon: 'pages.classes.camp.closingSoon',
  upcoming: 'pages.classes.camp.upcoming',
  closed: 'pages.classes.camp.full',
};

export default function CampSpotlight({ camp }: CampSpotlightProps) {
  const { locale, messages } = useLanguage();
  const isKo = locale === 'ko';

  // 모집 신호는 마운트 후 계산 (렌더 중 Date.now() 금지 + 하이드레이션 안정)
  const [signal, setSignal] = useState<EnrollmentSignal>(null);
  useEffect(() => {
    setSignal(getEnrollmentSignal(camp, Date.now()));
  }, [camp]);

  const title = isKo ? camp.title_ko : camp.title_en || camp.title_ko;
  const summary = isKo ? camp.summary_ko : camp.summary_en || camp.summary_ko;
  const price = isKo ? camp.price_ko : camp.price_en || camp.price_ko;
  const dates = formatRange(camp.start_date, camp.end_date, isKo);
  const imageUrl = camp.poster_url || camp.first_image_url || camp.thumbnail_url;

  const signalLabel = signal ? messages[SIGNAL_KEY[signal]] : null;

  return (
    <section className={`camp-spotlight ${imageUrl ? '' : 'camp-spotlight--no-image'}`}>
      {imageUrl && (
        <div className="camp-spotlight-bg" aria-hidden="true">
          <Image src={imageUrl} alt="" fill priority sizes="100vw" className="camp-spotlight-img" />
        </div>
      )}
      <div className="camp-spotlight-overlay" aria-hidden="true" />

      <div className="container camp-spotlight-inner">
        <div className="camp-spotlight-copy">
          <p className="camp-spotlight-eyebrow">
            <IntlObject keycode="pages.classes.camp.eyebrow" />
            {signalLabel && (
              <span className={`enroll-chip enroll-chip-${signal}`}>{signalLabel}</span>
            )}
          </p>

          <h2 className="camp-spotlight-title">{title}</h2>
          {summary && <p className="camp-spotlight-lede">{summary}</p>}

          <div className="camp-spotlight-facts">
            {dates && (
              <div className="camp-fact">
                <span className="camp-fact-label">{isKo ? '기간' : 'Dates'}</span>
                <span className="camp-fact-value">{dates}</span>
              </div>
            )}
            {camp.age_range && (
              <div className="camp-fact">
                <span className="camp-fact-label">{isKo ? '대상' : 'Ages'}</span>
                <span className="camp-fact-value">{camp.age_range}</span>
              </div>
            )}
            {price && (
              <div className="camp-fact">
                <span className="camp-fact-label">{isKo ? '참가비' : 'Tuition'}</span>
                <span className="camp-fact-value">{price}</span>
              </div>
            )}
          </div>

          <div className="camp-spotlight-actions">
            <Link href={`/classes/${camp.slug}#apply`} className="btn-ink-primary">
              <IntlObject keycode="pages.classes.camp.applyCta" />
            </Link>
            <Link href={`/classes/${camp.slug}`} className="btn-ink-ghost">
              <IntlObject keycode="pages.classes.card.viewDetails" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
