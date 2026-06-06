/**
 * ProgramGrid
 * 공개된 프로그램을 종류별 섹션(수업/프로그램/캠프)으로 묶어 카드 그리드로 표시.
 * 서버 컴포넌트 — 섹션 제목은 IntlObject(클라이언트), 카드는 ProgramCard(클라이언트)로 렌더.
 */

import IntlObject from '@/components/common/IntlObject';
import ProgramCard from './ProgramCard';
import type { ProgramWithMeta, ProgramType } from '@/types/programs';

interface ProgramGridProps {
  programs: ProgramWithMeta[];
}

const SECTION_ORDER: ProgramType[] = ['class', 'program', 'camp'];

export default function ProgramGrid({ programs }: ProgramGridProps) {
  const grouped = new Map<ProgramType, ProgramWithMeta[]>();
  for (const p of programs) {
    const list = grouped.get(p.program_type) || [];
    list.push(p);
    grouped.set(p.program_type, list);
  }

  const sections = SECTION_ORDER.filter((type) => (grouped.get(type)?.length ?? 0) > 0);

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="program-sections">
      {sections.map((type) => (
        <section className="program-section" key={type} aria-labelledby={`program-section-${type}`}>
          <div className="program-section-head">
            <IntlObject
              keycode={`pages.classes.sections.${type}`}
              returnType="h2"
              className="program-section-title"
            />
            <span className="dancheong-divider" aria-hidden="true" />
          </div>
          <div className="program-grid">
            {(grouped.get(type) || []).map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
