/**
 * ClassCard — 배정된 수업 1개를 카드로(원생·학부모 '내 수업'·아카이브 공용)
 *
 * 카드를 누르면 학생용 수업 상세(/admin/my-classes/[id])로 이동한다.
 * 일정 표기는 구조화 데이터(요일+시간)를 우선 쓰고, 없으면 자유 텍스트(schedule_ko)로 폴백.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { MyEnrollment } from '@/types/programs';
import { ENROLLMENT_STATUS_LABELS, PROGRAM_TYPE_LABELS } from '@/types/programs';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function scheduleText(p: MyEnrollment['program']): string {
  if (p.program_type === 'camp') {
    if (p.start_date && p.end_date) return `${p.start_date} ~ ${p.end_date}`;
    return p.start_date || '';
  }
  const days = (p.weekdays || '').split(',').filter(Boolean);
  if (days.length > 0) {
    const label = days.map((d) => WEEKDAY_KO[Number(d)] ?? '').join('·');
    const time = p.class_start_time
      ? ` ${p.class_start_time}${p.class_end_time ? `~${p.class_end_time}` : ''}`
      : '';
    return `매주 ${label}${time}`;
  }
  return p.schedule_ko || '';
}

export default function ClassCard({ item }: { item: MyEnrollment }) {
  const p = item.program;
  const thumb = p.thumbnail_url || p.poster_url || p.first_image_url || null;
  const schedule = scheduleText(p);

  return (
    <Link href={`/admin/my-classes/${p.id}`} className="myclass-card myclass-card-link">
      <div className="myclass-card-thumb">
        {thumb ? (
          <Image src={thumb} alt={p.title_ko} width={90} height={90} className="myclass-card-img" />
        ) : (
          <div className="myclass-card-noimg" aria-hidden="true">춤</div>
        )}
      </div>
      <div className="myclass-card-body">
        <div className="myclass-card-tags">
          <span className="myclass-tag">{PROGRAM_TYPE_LABELS[p.program_type].ko}</span>
          <span className={`myclass-status myclass-status-${item.status}`}>
            {ENROLLMENT_STATUS_LABELS[item.status].ko}
          </span>
        </div>
        <h3 className="myclass-card-title">{p.title_ko}</h3>
        {schedule && <p className="myclass-card-meta">{schedule}</p>}
        {p.location_ko && <p className="myclass-card-meta">{p.location_ko}</p>}
      </div>
    </Link>
  );
}
