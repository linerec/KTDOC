'use client';

/**
 * 아카이브의 공연 카드 — 체크인한 공연 1개
 *
 * 둘러보기 카드와 비슷하지만 두 가지가 다르다: 체크인한 날짜를 함께 보여주고,
 * 그 공연의 사진 몇 장을 띠로 미리 보여준다("내가 참여한 공연"이라는 느낌을 준다).
 */

import Link from 'next/link';
import type { CheckedInEvent, EventImage } from '@/types/gallery';
import { formatTimestampDate } from '@/lib/i18n/formatDate';
import { useT } from '@/lib/i18n/useT';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocaleText } from '@/components/common/LocaleText';

interface ArchiveEventCardProps {
  event: CheckedInEvent;
  /** 이 공연의 미리보기 사진(최대 3장) */
  strip: EventImage[];
  /** 학부모 화면: 누구(자녀)의 참여인지. 형제가 함께 참여하면 "지우 · 서준". */
  ownerLabel?: string | null;
}

export default function ArchiveEventCard({ event, strip, ownerLabel }: ArchiveEventCardProps) {
  const t = useT();
  const { locale } = useLanguage();
  const pick = useLocaleText();

  const title = pick(event.title_ko, event.title_en);
  const thumb = event.thumbnail_url || event.poster_url || strip[0]?.image_url || null;
  const isDraft = event.is_published === 0;

  return (
    <Link href={`/admin/library/${event.id}`} className="library-card">
      <div className="library-card-thumb">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={title} loading="lazy" />
        ) : (
          <span className="library-card-thumb-empty">
            {t('admin.library.noImage', '이미지 없음')}
          </span>
        )}
      </div>
      <div className="library-card-body">
        <span className="library-card-meta">
          {event.category_name_ko && (
            <span className="library-card-category">
              {pick(event.category_name_ko, event.category_name_en)}
            </span>
          )}
          {isDraft && (
            <span className="library-card-draft">{t('admin.common.unpublished', '비공개')}</span>
          )}
        </span>
        <h3 className="library-card-title">{title}</h3>
        <p className="library-card-date">{event.event_date}</p>
        <p className="archive-card-checkin">
          {ownerLabel && <span className="myclass-owner">{ownerLabel}</span>}
          {t('admin.archive.checkedInAt', '참여 체크인 · {date}', {
            date: formatTimestampDate(event.checked_in_at, locale),
          })}
        </p>
      </div>
      {strip.length > 0 && (
        <div className="archive-strip">
          {strip.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.id} src={img.image_url} alt="" loading="lazy" />
          ))}
        </div>
      )}
    </Link>
  );
}
