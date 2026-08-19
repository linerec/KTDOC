'use client';

/**
 * ClassCard — 배정된 수업 1개를 카드로(원생·학부모 '내 수업'·아카이브 공용)
 *
 * 카드를 누르면 학생용 수업 상세(/admin/my-classes/[id])로 이동한다.
 * 일정 표기는 구조화 데이터(요일+시간)를 우선 쓰고, 없으면 자유 텍스트(schedule_ko)로 폴백 —
 * 계산은 lib/programText의 formatClassSchedule이 맡는다(수업 상세와 같은 함수).
 */

import Link from 'next/link';
import Image from 'next/image';
import type { MyEnrollment } from '@/types/programs';
import { useT } from '@/lib/i18n/useT';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocaleText } from '@/components/common/LocaleText';
import { programTypeLabel, enrollmentStatusLabel } from '@/lib/i18n/programLabels';
import { formatClassSchedule } from '@/lib/programText';

export default function ClassCard({
  item,
  ownerLabel,
}: {
  item: MyEnrollment;
  /** 학부모 화면: 이 수업이 누구(자녀)의 것인지. 형제가 함께 다니면 "지우 · 서준". */
  ownerLabel?: string | null;
}) {
  const t = useT();
  const { locale } = useLanguage();
  const pick = useLocaleText();

  const p = item.program;
  const thumb = p.thumbnail_url || p.poster_url || p.first_image_url || null;
  const schedule = formatClassSchedule(p, locale);
  const title = pick(p.title_ko, p.title_en);

  return (
    <Link href={`/admin/my-classes/${p.id}`} className="myclass-card myclass-card-link">
      <div className="myclass-card-thumb">
        {thumb ? (
          <Image src={thumb} alt={title} width={90} height={90} className="myclass-card-img" />
        ) : (
          <div className="myclass-card-noimg" aria-hidden="true">
            춤
          </div>
        )}
      </div>
      <div className="myclass-card-body">
        <div className="myclass-card-tags">
          <span className="myclass-tag">{programTypeLabel(t, p.program_type)}</span>
          <span className={`myclass-status myclass-status-${item.status}`}>
            {enrollmentStatusLabel(t, item.status)}
          </span>
          {ownerLabel && <span className="myclass-owner">{ownerLabel}</span>}
        </div>
        <h3 className="myclass-card-title">{title}</h3>
        {schedule && <p className="myclass-card-meta">{schedule}</p>}
        {(p.location_ko || p.location_en) && (
          <p className="myclass-card-meta">{pick(p.location_ko, p.location_en)}</p>
        )}
      </div>
    </Link>
  );
}
