/**
 * 콘솔 공연 상세 (읽기 전용)
 *
 * 둘러보기·아카이브에서 공연을 누르면 열리는 상세 화면. 공개 갤러리 상세(`/gallery/...`)와 달리
 * 콘솔 안에서 열리며 **비공개(미공개) 공연도** 볼 수 있다(학생이 참여한 공연이 아직
 * 아카이브에 공개되지 않았어도 내용·사진을 확인). 접근: library 메뉴 권한.
 * 학생에게는 상단에 체크인 토글을 함께 제공한다.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getEventById, isCheckedIn, getEventCheckins, getEventSupplies, getEventSupplySets } from '@/lib/d1';
import { getUserNamesByIds, getGuardianChildren } from '@/lib/members';
import { isStaff, canSelfCheckIn } from '@/lib/isAdmin';
import SupplyList from '@/components/supplies/SupplyList';
import { getCommentThreads } from '@/lib/comments/thread';
import CommentSection from '@/components/comments/CommentSection';
import { formatEventDate } from '@/types/gallery';
import type { MemberRole } from '@/types/members';
import EventLocationMap from '@/components/events/EventLocationMap';
import { LocaleImageGallery, LocaleVideoList } from '@/components/admin/library/LocaleMedia';
import T from '@/components/common/T';
import LocaleText from '@/components/common/LocaleText';
import CheckinButton from '@/components/admin/library/CheckinButton';
import ParentCheckin from '@/components/admin/library/ParentCheckin';
import PhotoSubmitModal from '@/components/admin/library/PhotoSubmitModal';

export const metadata: Metadata = {
  title: '공연 상세 | KTDOC Admin',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminLibraryEventPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'library');

  const { id } = await params;
  const eventId = parseInt(id, 10);
  if (Number.isNaN(eventId)) notFound();

  const event = await getEventById(eventId);
  if (!event) notFound();

  const [eventSupplies, eventSupplySets, commentThreads] = await Promise.all([
    getEventSupplies(eventId),
    getEventSupplySets(eventId),
    getCommentThreads('event', eventId),
  ]);
  const role = (session?.user?.role ?? 'user') as MemberRole;
  const userId = session?.user?.id ?? null;
  const canCheckIn = canSelfCheckIn(session) && !!userId;
  const isParent = role === 'parent' && !!userId;
  const checkedIn = canCheckIn ? await isCheckedIn(eventId, userId) : false;

  // 다가오는 공연 여부(event_date는 'YYYY-MM-DD' 문자열이라 사전식 비교로 충분)
  const today = new Date().toISOString().slice(0, 10);
  const isUpcoming = event.event_date >= today;

  // 참가자(체크인 인원) — 이름은 MySQL에서 해석
  const checkins = await getEventCheckins(eventId);
  const participantNames = await getUserNamesByIds(checkins.map((c) => c.user_id));

  // 학부모: 연결된 자녀 + 이 공연 참여 여부(대행 체크인용)
  const checkedUserIds = new Set(checkins.map((c) => c.user_id));
  const guardianChildren = isParent
    ? (await getGuardianChildren(userId)).map((c) => ({
        ...c,
        checkedIn: checkedUserIds.has(c.studentId),
      }))
    : [];

  const isDraft = event.is_published === 0;
  const hasContent =
    !!event.description_ko || event.images.length > 0 || event.videos.length > 0;

  // 실행 정보가 하나라도 있는지
  const hasCoords = event.location_lat !== null && event.location_lng !== null;
  const hasLogistics =
    !!event.location ||
    !!event.location_url ||
    !!event.location_address ||
    hasCoords ||
    !!event.call_time ||
    !!event.start_time ||
    !!event.end_time ||
    !!event.prep_notes;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/library">
              <T k="admin.nav.library">공연 둘러보기</T>
            </Link>
            <span>/</span>
            <span>
              <LocaleText ko={event.title_ko} en={event.title_en} />
            </span>
          </div>
          <h1 className="admin-title">
            <LocaleText ko={event.title_ko} en={event.title_en} />
          </h1>
          <p className="admin-subtitle library-detail-sub">
            {isUpcoming && (
              <span className="library-upcoming-badge">
                <T k="admin.library.upcomingSection">다가오는 공연</T>
              </span>
            )}
            {event.category_name_ko && (
              <span>
                <LocaleText ko={event.category_name_ko} en={event.category_name_en} />
              </span>
            )}
            <span>
              <LocaleText
                ko={formatEventDate(event.event_date, 'ko')}
                en={formatEventDate(event.event_date, 'en')}
              />
            </span>
            {isDraft && (
              <span className="library-card-draft">
                <T k="admin.common.unpublished">비공개</T>
              </span>
            )}
          </p>
        </div>
      </div>

      {canCheckIn && (
        <div className="library-detail-checkin">
          <CheckinButton eventId={eventId} initialCheckedIn={checkedIn} upcoming={isUpcoming} />
        </div>
      )}

      {isParent && (
        <section className="library-detail-section">
          <h2 className="library-detail-section-title">
            <T k="admin.checkin.childSection">자녀 참여 체크인</T>
          </h2>
          <ParentCheckin
            eventId={eventId}
            childrenList={guardianChildren}
            upcoming={isUpcoming}
          />
        </section>
      )}

      {/* 실행 정보 — 어디서·언제·무엇을 준비 (다가오는 공연에서 특히 중요) */}
      {hasLogistics && (
        <section className="event-logistics">
          {(event.location || event.location_url || event.location_address || hasCoords) && (
            <div className="event-logistics-item">
              <span className="event-logistics-label">
                <T k="admin.common.location">장소</T>
              </span>
              <span className="event-logistics-value">
                <EventLocationMap
                  location={event.location}
                  address={event.location_address}
                  lat={event.location_lat}
                  lng={event.location_lng}
                  locationUrl={event.location_url}
                  directionsLabel={<T k="admin.library.directions">길찾기</T>}
                  largerMapLabel={<T k="admin.library.largerMap">큰 지도로 보기</T>}
                />
              </span>
            </div>
          )}
          {(event.call_time || event.start_time || event.end_time) && (
            <div className="event-logistics-item">
              <span className="event-logistics-label">
                <T k="admin.library.time">시간</T>
              </span>
              <span className="event-logistics-value">
                {event.call_time && (
                  <T k="admin.library.callAt" params={{ t: event.call_time }}>
                    {'집합 {t}'}
                  </T>
                )}
                {event.start_time && (
                  <>
                    {' · '}
                    <T k="admin.library.startAt" params={{ t: event.start_time }}>
                      {'시작 {t}'}
                    </T>
                  </>
                )}
                {event.end_time && (
                  <>
                    {' · '}
                    <T k="admin.library.endAt" params={{ t: event.end_time }}>
                      {'종료 {t}'}
                    </T>
                  </>
                )}
              </span>
            </div>
          )}
          {event.prep_notes && (
            <div className="event-logistics-item">
              <span className="event-logistics-label">
                <T k="admin.library.prep">준비물 · 안내</T>
              </span>
              <span className="event-logistics-value event-logistics-prep">{event.prep_notes}</span>
            </div>
          )}
        </section>
      )}

      <SupplyList supplies={eventSupplies} sets={eventSupplySets} />

      {/* 참가자(체크인 인원) */}
      <section className="event-participants">
        <h2 className="library-detail-section-title">
          <T k="admin.library.participants">참가자</T>{' '}
          <span className="event-participants-count">{checkins.length}</span>
        </h2>
        {checkins.length === 0 ? (
          <p className="event-participants-empty">
            <T k="admin.library.noParticipants">아직 체크인한 참가자가 없습니다.</T>
          </p>
        ) : (
          <ul className="participation-people">
            {checkins.map((c) => (
              <li key={c.id} className="participation-person">
                <span className="participation-person-name">
                  {participantNames.get(c.user_id) || (
                    <T k="admin.library.unknownName">이름 미상</T>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {event.description_ko && (
        <p className="library-detail-desc">
          <LocaleText ko={event.description_ko} en={event.description_en} />
        </p>
      )}

      {(canCheckIn || isParent) && (
        <section className="library-detail-section">
          <h2 className="library-detail-section-title">
            <T k="admin.photoSubmit.button">사진 올리기</T>
          </h2>
          <p className="admin-form-help">
            <T k="admin.library.photoHelp">
              이 공연에서 찍은 사진을 올리면 운영진 검토 후 공개 갤러리에 반영됩니다.
            </T>
          </p>
          <PhotoSubmitModal
            eventId={eventId}
            buttonLabelKey="admin.library.submitPhoto"
            buttonLabel="이 공연에 사진 올리기"
          />
        </section>
      )}

      {event.images.length > 0 && (
        <section className="library-detail-section">
          <h2 className="library-detail-section-title">
            <T
              k="admin.library.photoCount"
              params={{ n: event.image_total ?? event.images.length }}
            >
              {'사진 {n}장'}
            </T>
          </h2>
          <LocaleImageGallery images={event.images} total={event.image_total} />
        </section>
      )}

      {event.videos.length > 0 && (
        <section className="library-detail-section">
          <h2 className="library-detail-section-title">
            <T k="admin.library.videos">영상</T>
          </h2>
          <LocaleVideoList videos={event.videos} />
        </section>
      )}

      {!hasContent && (
        <div className="admin-empty-state">
          <p>
            <T k="admin.library.noContent">아직 등록된 상세 내용(사진·영상·설명)이 없습니다.</T>
          </p>
        </div>
      )}

      {userId && (
        <CommentSection
          targetType="event"
          targetId={eventId}
          currentUserId={userId}
          currentUserName={session?.user?.name || '회원'}
          canAnnounce={isStaff(session)}
          threads={commentThreads}
        />
      )}
    </div>
  );
}
