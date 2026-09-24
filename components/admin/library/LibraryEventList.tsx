'use client';

/**
 * 둘러보기의 공연 목록 — 카드 격자와 게시판형 줄, 두 모습
 *
 * 두 모습은 배지(참여함/다가오는/비공개/카테고리)와 링크 대상, 체크인 버튼이 모두 같고
 * 배치만 다르다. 예전에는 페이지 안에 두 벌로 적혀 있어 한쪽만 고치면 어긋났다.
 *
 * 링크 대상이 갈리는 이유: 멤버(원생·학부모)는 비공개 공연도 보므로 콘솔 상세로 가고,
 * 그 외 역할은 공개 갤러리 페이지로 나간다.
 *
 * 카드·줄마다 `id`(libraryCardId)가 있다 — 공연 알림을 누르면 `/admin/library#event-<id>`로
 * 와서 그 포스터 앞에 멈춘다(lib/library/anchor.ts). 도착한 카드는 CSS `:target`이 잠깐 비춘다.
 */

import Link from 'next/link';
import SiteViewLink from '@/components/common/SiteViewLink';
import type { EventWithCategory } from '@/types/gallery';
import { useT } from '@/lib/i18n/useT';
import { useLocaleText } from '@/components/common/LocaleText';
import { libraryCardId } from '@/lib/library/anchor';
import { responseOf } from '@/lib/library/response';
import EventResponseButtons from './EventResponseButtons';
import type { LibraryView } from './LibraryViewToggle';

interface LibraryEventListProps {
  events: EventWithCategory[];
  view: LibraryView;
  /** 멤버(원생·학부모)인가 — 콘솔 상세로 보낼지 공개 페이지로 보낼지 */
  memberView: boolean;
  canCheckIn: boolean;
  /** 참여 표시(✓)를 보여줄지 — 본인 체크인(학생) 또는 자녀 체크인(학부모) */
  showMarks?: boolean;
  /** 본인(학부모는 자녀)이 체크인한 공연 id (Set은 직렬화가 안 돼 배열로 받는다) */
  checkedInIds: number[];
  /** 본인(학부모는 자녀)이 불참한 공연 id */
  declinedIds?: number[];
  /** 'YYYY-MM-DD' — 이 날짜 이후면 다가오는 공연 */
  today: string;
}

export default function LibraryEventList({
  events,
  view,
  memberView,
  canCheckIn,
  showMarks = false,
  checkedInIds,
  declinedIds = [],
  today,
}: LibraryEventListProps) {
  const t = useT();
  const pick = useLocaleText();
  const checkedIn = new Set(checkedInIds);
  const declined = new Set(declinedIds);

  /** 공연 하나의 상태 — 카드와 줄이 같은 판단을 쓴다 */
  const stateOf = (event: EventWithCategory) => ({
    title: pick(event.title_ko, event.title_en),
    category: event.category_name_ko
      ? pick(event.category_name_ko, event.category_name_en)
      : null,
    isDraft: event.is_published === 0,
    isChecked: (showMarks || canCheckIn) && checkedIn.has(event.id),
    // 불참 표시는 다가오는 공연에만 — 지난 공연의 '불참'은 할 일도 기록도 아니다.
    // 참여가 이긴다(둘 다 남은 순간) — responseOf가 그 판단을 한다.
    isDeclined:
      (showMarks || canCheckIn) &&
      event.event_date >= today &&
      responseOf(checkedIn.has(event.id), declined.has(event.id)) === 'declined',
    isUpcoming: event.event_date >= today,
  });

  /** 참여 배지 문구 — 다가오는 공연이면 예정, 지난 공연이면 참여함 */
  const joinedLabel = (isUpcoming: boolean) =>
    isUpcoming
      ? t('admin.library.joinedUpcoming', '참여 예정')
      : t('admin.library.joinedPast', '참여함');

  /** 카드/줄 공통 — 링크로 감싸고 참여 응답 버튼을 붙인다 */
  const wrap = (
    event: EventWithCategory,
    className: string,
    linkClassName: string,
    isChecked: boolean,
    isDeclined: boolean,
    isUpcoming: boolean,
    inner: React.ReactNode
  ) => (
    <div
      key={event.id}
      id={libraryCardId(event.id)}
      className={`${className}${isChecked ? ' is-checked' : ''}${isDeclined ? ' is-declined' : ''}`}
    >
      {memberView ? (
        <Link href={`/admin/library/${event.id}`} className={linkClassName}>
          {inner}
        </Link>
      ) : (
        <SiteViewLink href={`/gallery/${event.year}/${event.slug}`} className={linkClassName}>
          {inner}
        </SiteViewLink>
      )}
      {canCheckIn && (
        <EventResponseButtons
          eventId={event.id}
          initialResponse={responseOf(checkedIn.has(event.id), declined.has(event.id))}
          upcoming={isUpcoming}
        />
      )}
    </div>
  );

  if (view === 'list') {
    return (
      <div className="library-rows">
        {events.map((event) => {
          const { title, category, isDraft, isChecked, isDeclined, isUpcoming } = stateOf(event);
          return wrap(
            event,
            'library-row',
            'library-row-link',
            isChecked,
            isDeclined,
            isUpcoming,
            <>
              <span className="library-row-date">{event.event_date}</span>
              <span className="library-row-main">
                <span className="library-row-title">{title}</span>
                {category && <span className="library-row-category">{category}</span>}
                {isDraft && (
                  <span className="library-card-draft">
                    {t('admin.common.unpublished', '비공개')}
                  </span>
                )}
                {isChecked && (
                  <span className="library-row-checked">✓ {joinedLabel(isUpcoming)}</span>
                )}
                {isDeclined && (
                  <span className="library-row-declined">
                    {t('admin.library.declined', '불참')}
                  </span>
                )}
                {!isChecked && !isDeclined && isUpcoming && (
                  <span className="library-row-upcoming">
                    {t('admin.library.upcoming', '다가오는')}
                  </span>
                )}
              </span>
            </>
          );
        })}
      </div>
    );
  }

  return (
    <div className="library-grid">
      {events.map((event) => {
        const { title, category, isDraft, isChecked, isDeclined, isUpcoming } = stateOf(event);
        const thumb = event.thumbnail_url || event.poster_url || event.first_image_url || null;
        return wrap(
          event,
          'library-card',
          'library-card-link',
          isChecked,
          isDeclined,
          isUpcoming,
          <>
            <div className="library-card-thumb">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt={title} loading="lazy" />
              ) : (
                <span className="library-card-thumb-empty">
                  {t('admin.library.noImage', '이미지 없음')}
                </span>
              )}
              {isChecked && (
                <span className="library-card-checked-flag">✓ {joinedLabel(isUpcoming)}</span>
              )}
              {isDeclined && (
                <span className="library-card-declined-flag">
                  {t('admin.library.declined', '불참')}
                </span>
              )}
              {!isChecked && !isDeclined && isUpcoming && (
                <span className="library-card-upcoming-flag">
                  {t('admin.library.upcoming', '다가오는')}
                </span>
              )}
            </div>
            <div className="library-card-body">
              <span className="library-card-meta">
                {category && <span className="library-card-category">{category}</span>}
                {isDraft && (
                  <span className="library-card-draft">
                    {t('admin.common.unpublished', '비공개')}
                  </span>
                )}
              </span>
              <h3 className="library-card-title">{title}</h3>
              <p className="library-card-date">{event.event_date}</p>
            </div>
          </>
        );
      })}
    </div>
  );
}
