/**
 * 콘솔 이벤트 상세 (읽기 전용)
 *
 * 둘러보기·아카이브에서 이벤트를 누르면 열리는 상세 화면. 공개 갤러리 상세(`/gallery/...`)와 달리
 * 콘솔 안에서 열리며 **비공개(미공개) 이벤트도** 볼 수 있다(학생이 참여한 이벤트가 아직
 * 아카이브에 공개되지 않았어도 내용·사진을 확인). 접근: library 메뉴 권한.
 * 학생에게는 상단에 체크인 토글을 함께 제공한다.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getEventById, isCheckedIn, getEventCheckins } from '@/lib/d1';
import { getUserNamesByIds, getGuardianChildren } from '@/lib/members';
import { formatEventDate } from '@/types/gallery';
import type { MemberRole } from '@/types/members';
import ImageGallery from '@/components/gallery/ImageGallery';
import { VideoList } from '@/components/gallery/VideoEmbed';
import CheckinButton from '@/components/admin/library/CheckinButton';
import ParentCheckin from '@/components/admin/library/ParentCheckin';

export const metadata: Metadata = {
  title: '이벤트 상세 | KTDOC Admin',
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

  const role = (session?.user?.role ?? 'user') as MemberRole;
  const userId = session?.user?.id ?? null;
  const canCheckIn = role === 'student' && !!userId;
  const isParent = role === 'parent' && !!userId;
  const checkedIn = canCheckIn ? await isCheckedIn(eventId, userId) : false;

  // 다가오는 이벤트 여부(event_date는 'YYYY-MM-DD' 문자열이라 사전식 비교로 충분)
  const today = new Date().toISOString().slice(0, 10);
  const isUpcoming = event.event_date >= today;

  // 참가자(체크인 인원) — 이름은 MySQL에서 해석
  const checkins = await getEventCheckins(eventId);
  const participantNames = await getUserNamesByIds(checkins.map((c) => c.user_id));

  // 학부모: 연결된 자녀 + 이 이벤트 참여 여부(대행 체크인용)
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
  const hasLogistics =
    !!event.location ||
    !!event.location_url ||
    !!event.call_time ||
    !!event.start_time ||
    !!event.end_time ||
    !!event.prep_notes;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/library">이벤트 둘러보기</Link>
            <span>/</span>
            <span>{event.title_ko}</span>
          </div>
          <h1 className="admin-title">{event.title_ko}</h1>
          <p className="admin-subtitle library-detail-sub">
            {isUpcoming && <span className="library-upcoming-badge">다가오는 이벤트</span>}
            {event.category_name_ko && <span>{event.category_name_ko}</span>}
            <span>{formatEventDate(event.event_date, 'ko')}</span>
            {isDraft && <span className="library-card-draft">비공개</span>}
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
          <h2 className="library-detail-section-title">자녀 참여 체크인</h2>
          <ParentCheckin
            eventId={eventId}
            childrenList={guardianChildren}
            upcoming={isUpcoming}
          />
        </section>
      )}

      {/* 실행 정보 — 어디서·언제·무엇을 준비 (다가오는 이벤트에서 특히 중요) */}
      {hasLogistics && (
        <section className="event-logistics">
          {(event.location || event.location_url) && (
            <div className="event-logistics-item">
              <span className="event-logistics-label">장소</span>
              <span className="event-logistics-value">
                {event.location || '장소 안내'}
                {event.location_url && (
                  <a
                    href={event.location_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-logistics-map"
                  >
                    지도 보기 ↗
                  </a>
                )}
              </span>
            </div>
          )}
          {(event.call_time || event.start_time || event.end_time) && (
            <div className="event-logistics-item">
              <span className="event-logistics-label">시간</span>
              <span className="event-logistics-value">
                {event.call_time && <>집합 {event.call_time}</>}
                {event.start_time && <> · 시작 {event.start_time}</>}
                {event.end_time && <> · 종료 {event.end_time}</>}
              </span>
            </div>
          )}
          {event.prep_notes && (
            <div className="event-logistics-item">
              <span className="event-logistics-label">준비물 · 안내</span>
              <span className="event-logistics-value event-logistics-prep">{event.prep_notes}</span>
            </div>
          )}
        </section>
      )}

      {/* 참가자(체크인 인원) */}
      <section className="event-participants">
        <h2 className="library-detail-section-title">
          참가자 <span className="event-participants-count">{checkins.length}</span>
        </h2>
        {checkins.length === 0 ? (
          <p className="event-participants-empty">아직 체크인한 참가자가 없습니다.</p>
        ) : (
          <ul className="participation-people">
            {checkins.map((c) => (
              <li key={c.id} className="participation-person">
                <span className="participation-person-name">
                  {participantNames.get(c.user_id) || '이름 미상'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {event.description_ko && (
        <p className="library-detail-desc">{event.description_ko}</p>
      )}

      {event.images.length > 0 && (
        <section className="library-detail-section">
          <h2 className="library-detail-section-title">사진 {event.image_total ?? event.images.length}장</h2>
          <ImageGallery images={event.images} total={event.image_total} locale="ko" />
        </section>
      )}

      {event.videos.length > 0 && (
        <section className="library-detail-section">
          <h2 className="library-detail-section-title">영상</h2>
          <VideoList videos={event.videos} locale="ko" />
        </section>
      )}

      {!hasContent && (
        <div className="admin-empty-state">
          <p>아직 등록된 상세 내용(사진·영상·설명)이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
