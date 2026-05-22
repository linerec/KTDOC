/**
 * Admin Gallery Edit Event Page
 * 이벤트 편집
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getEventById, getCategories } from '@/lib/d1';
import EventForm from '@/components/admin/gallery/EventForm';

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
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const eventId = parseInt(id);

  if (isNaN(eventId)) {
    notFound();
  }

  const [event, categories] = await Promise.all([
    getEventById(eventId),
    getCategories(),
  ]);

  if (!event) {
    notFound();
  }

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
            {event.year}년 · {event.is_published ? '공개 Gallery에 표시 중' : '비공개 저장 중'}
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
        <EventForm event={event} categories={categories} />
      </div>
    </div>
  );
}
