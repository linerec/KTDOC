'use client';

/**
 * ProgramCard
 * 수업·프로그램·캠프 카드. 갤러리 EventCard 계열 디자인을 확장.
 * 첫 묶음 사진(또는 포스터)을 카드 이미지로 사용하고, 종류에 따라 메타 정보가 달라짐.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { ProgramWithMeta } from '@/types/programs';
import { PROGRAM_TYPE_LABELS } from '@/types/programs';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProgramCardProps {
  program: ProgramWithMeta;
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const fmt = (s: string) => {
    const d = new Date(s + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return s;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  if (end && end !== start) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start);
}

export default function ProgramCard({ program }: ProgramCardProps) {
  const { locale, messages } = useLanguage();
  const isKo = locale === 'ko';

  const title = isKo ? program.title_ko : program.title_en || program.title_ko;
  const summary = isKo ? program.summary_ko : program.summary_en || program.summary_ko;
  const price = isKo ? program.price_ko : program.price_en || program.price_ko;
  const schedule = isKo ? program.schedule_ko : program.schedule_en || program.schedule_ko;

  const imageUrl = program.poster_url || program.first_image_url || program.thumbnail_url;
  const typeLabel = isKo
    ? PROGRAM_TYPE_LABELS[program.program_type].ko
    : PROGRAM_TYPE_LABELS[program.program_type].en;

  const dateText =
    program.program_type === 'camp' ? formatDateRange(program.start_date, program.end_date) : schedule;

  return (
    <Link href={`/classes/${program.slug}`} className="program-card" aria-label={title}>
      <div className="program-card-image">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="program-card-img"
          />
        ) : (
          <div className="program-card-placeholder" aria-hidden="true">
            <span>춤누리</span>
          </div>
        )}
        <span className={`program-card-type program-card-type-${program.program_type}`}>
          {typeLabel}
        </span>
      </div>

      <div className="program-card-body">
        <h3 className="program-card-title">{title}</h3>
        {summary && <p className="program-card-summary">{summary}</p>}

        <dl className="program-card-meta">
          {dateText && (
            <div className="program-card-meta-row">
              <dt>{program.program_type === 'camp' ? (isKo ? '기간' : 'Dates') : isKo ? '일정' : 'Schedule'}</dt>
              <dd>{dateText}</dd>
            </div>
          )}
          {program.age_range && (
            <div className="program-card-meta-row">
              <dt>{isKo ? '대상' : 'Ages'}</dt>
              <dd>{program.age_range}</dd>
            </div>
          )}
        </dl>

        <div className="program-card-footer">
          {price && <span className="program-card-price">{price}</span>}
          <span className="program-card-cta">
            {messages['pages.classes.card.viewDetails'] || (isKo ? '자세히 보기' : 'View Details')}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
