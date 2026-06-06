'use client';

/**
 * ProgramDetailFacts
 * 상세 페이지 사이드바 — 일정/기간·대상·수강료·장소를 이중언어로 표시.
 */

import { useLanguage } from '@/contexts/LanguageContext';
import type { ProgramDetail } from '@/types/programs';

interface ProgramDetailFactsProps {
  program: ProgramDetail;
}

function formatRange(start: string | null, end: string | null, isKo: boolean): string | null {
  if (!start) return null;
  const fmt = (s: string) => {
    const d = new Date(s + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return s;
    return isKo
      ? `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
      : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  if (end && end !== start) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start);
}

export default function ProgramDetailFacts({ program }: ProgramDetailFactsProps) {
  const { locale, messages } = useLanguage();
  const isKo = locale === 'ko';
  const t = (key: string, fallback: string) => messages[key] || fallback;

  const schedule =
    program.program_type === 'camp'
      ? formatRange(program.start_date, program.end_date, isKo)
      : isKo
      ? program.schedule_ko
      : program.schedule_en || program.schedule_ko;
  const price = isKo ? program.price_ko : program.price_en || program.price_ko;
  const location = isKo ? program.location_ko : program.location_en || program.location_ko;

  const facts: { label: string; value: string }[] = [];
  if (schedule) facts.push({ label: t('programs.detail.scheduleTitle', '일정'), value: schedule });
  if (program.age_range) facts.push({ label: t('programs.detail.ageTitle', '대상 연령'), value: program.age_range });
  if (price) facts.push({ label: t('programs.detail.priceTitle', '수강료'), value: price });
  if (location) facts.push({ label: t('programs.detail.locationTitle', '장소'), value: location });

  if (facts.length === 0) return null;

  return (
    <div className="program-facts-card">
      <dl className="program-facts-list">
        {facts.map((f) => (
          <div className="program-facts-row" key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      <a href="#apply" className="btn-ink-primary program-facts-cta">
        {t('programs.detail.applyCta', '신청하기')}
      </a>
    </div>
  );
}
