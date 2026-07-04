/**
 * Admin Gallery Edit Event Page
 * 이벤트 편집
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getEventById, getCategories, getActiveSupplyItems, getEventSupplies, getActiveSupplySets, getEventSupplySets } from '@/lib/d1';
import { isStaff } from '@/lib/isAdmin';
import EventForm from '@/components/admin/gallery/EventForm';
import { getCommentThreads } from '@/lib/comments/thread';
import CommentSection from '@/components/comments/CommentSection';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const event = await getEventById(parseInt(id));

  return {
    title: event ? `${event.title_ko} 편집 | KTDOC Admin` : '이벤트 편집 | KTDOC Admin',
  };
}

export default async function AdminGalleryEditPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'gallery');

  const { id } = await params;
  const eventId = parseInt(id);

  if (isNaN(eventId)) {
    notFound();
  }

  const [event, categories, activeSupplies, eventSupplies, activeSupplySets, eventSupplySets, commentThreads] = await Promise.all([
    getEventById(eventId),
    getCategories(),
    getActiveSupplyItems(),
    getEventSupplies(eventId),
    getActiveSupplySets(),
    getEventSupplySets(eventId),
    getCommentThreads('event', eventId),
  ]);

  if (!event) {
    notFound();
  }

  const initialSupplies = eventSupplies.map((s) => ({
    supply_item_id: s.supply_item_id,
    quantity: s.quantity ?? '',
    note_ko: s.note_ko ?? '',
    note_en: s.note_en ?? '',
    is_required: s.is_required === 1,
  }));
  const initialSupplySets = eventSupplySets.map((s) => ({
    supply_set_id: s.supply_set_id,
    quantity: s.quantity ?? '',
    note_ko: s.note_ko ?? '',
    note_en: s.note_en ?? '',
    is_required: s.is_required === 1,
  }));

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/gallery">이벤트 아카이브</Link>
            <span>/</span>
            <span>{event.title_ko}</span>
          </div>
          <h1 className="admin-title">아카이브 이벤트 편집</h1>
          <p className="admin-subtitle">
            {event.year}년 · {event.is_published ? '공개 갤러리 페이지에 표시 중' : '비공개 저장 중'}
          </p>
        </div>
        <div className="admin-header-actions">
          {event.is_published ? (
            <Link
              href={`/gallery/${event.year}/${event.slug}`}
              target="_blank"
              className="admin-btn admin-btn-outline"
            >
              공개 페이지 보기
            </Link>
          ) : null}
        </div>
      </div>

      <div className="admin-content">
        <EventForm
          event={event}
          categories={categories}
          activeSupplies={activeSupplies}
          initialSupplies={initialSupplies}
          activeSupplySets={activeSupplySets}
          initialSupplySets={initialSupplySets}
        />
      </div>

      {session?.user?.id && (
        <CommentSection
          targetType="event"
          targetId={eventId}
          currentUserId={session.user.id}
          currentUserName={session.user.name || '선생님'}
          canAnnounce={isStaff(session)}
          threads={commentThreads}
        />
      )}
    </div>
  );
}
