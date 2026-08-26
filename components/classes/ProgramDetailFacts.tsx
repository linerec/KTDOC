'use client';

/**
 * ProgramDetailFacts
 * 상세 페이지 사이드바 — 일정/기간·대상·수강료·장소를 이중언어로 표시.
 *
 * 신청 버튼은 **스스로 판단하지 않는다.** 예전에는 여기서 무조건 옛 모달을 열어,
 * 히어로 CTA가 신청서로 가는 동안 같은 페이지의 이 버튼만 옛 저장소로 신청을
 * 떨어뜨렸다(글자·스타일까지 같아 방문자가 구별할 방법이 없었다).
 * 이제 applyMode 를 상세 페이지에서 받아 그대로 따른다.
 */

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { ApplyButton } from '@/components/classes/ApplyModal';
import type { ProgramDetail } from '@/types/programs';

interface ProgramDetailFactsProps {
  program: ProgramDetail;
  /** 상세 페이지가 정한 신청 경로. 사이드바는 이 결정을 따르기만 한다. */
  applyMode: 'form' | 'closed' | 'legacy';
  formSlug: string | null;
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

export default function ProgramDetailFacts({
  program,
  applyMode,
  formSlug,
}: ProgramDetailFactsProps) {
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
      {applyMode === 'form' && formSlug && (
        <Link href={`/f/${formSlug}`} className="btn-ink-primary program-facts-cta">
          {t('programs.detail.applyCta', '신청하기')}
        </Link>
      )}
      {applyMode === 'closed' && (
        <span className="program-facts-cta is-closed" aria-disabled="true">
          {t('programs.detail.applyClosed', '접수 마감')}
        </span>
      )}
      {applyMode === 'legacy' && (
        <ApplyButton className="btn-ink-primary program-facts-cta">
          {t('programs.detail.applyCta', '신청하기')}
        </ApplyButton>
      )}
    </div>
  );
}
