'use client';

/**
 * RepertoireSection
 * 카테고리별 공연 묶음 섹션 (이중언어 제목).
 */

import { useLanguage } from '@/contexts/LanguageContext';
import PerformanceCard from './PerformanceCard';
import type { EventWithCategory } from '@/types/gallery';

interface RepertoireSectionProps {
  categoryKo: string;
  categoryEn: string;
  events: EventWithCategory[];
}

export default function RepertoireSection({ categoryKo, categoryEn, events }: RepertoireSectionProps) {
  const { locale } = useLanguage();
  const title = locale === 'ko' ? categoryKo : categoryEn || categoryKo;

  if (events.length === 0) return null;

  return (
    <section className="repertoire-section">
      <div className="repertoire-head">
        <h2 className="repertoire-title">{title}</h2>
        <span className="dancheong-divider" aria-hidden="true" />
      </div>
      <div className="performance-grid">
        {events.map((event) => (
          <PerformanceCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}
