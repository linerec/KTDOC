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
import { getEventById, isCheckedIn } from '@/lib/d1';
import { formatEventDate } from '@/types/gallery';
import type { MemberRole } from '@/types/members';
import ImageGallery from '@/components/gallery/ImageGallery';
import { VideoList } from '@/components/gallery/VideoEmbed';
import CheckinButton from '@/components/admin/library/CheckinButton';

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
  const checkedIn = canCheckIn ? await isCheckedIn(eventId, userId) : false;

  const isDraft = event.is_published === 0;
  const hasContent =
    !!event.description_ko || event.images.length > 0 || event.videos.length > 0;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/library">공연 · 갤러리 둘러보기</Link>
            <span>/</span>
            <span>{event.title_ko}</span>
          </div>
          <h1 className="admin-title">{event.title_ko}</h1>
          <p className="admin-subtitle library-detail-sub">
            {event.category_name_ko && <span>{event.category_name_ko}</span>}
            <span>{formatEventDate(event.event_date, 'ko')}</span>
            {isDraft && <span className="library-card-draft">비공개</span>}
          </p>
        </div>
      </div>

      {canCheckIn && (
        <div className="library-detail-checkin">
          <CheckinButton eventId={eventId} initialCheckedIn={checkedIn} />
        </div>
      )}

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
