/**
 * 이벤트 id → canonical 상세로 리다이렉트 — /gallery/event/[id]
 *
 * 알림(푸시) 딥링크용 안정 경로. slug/year를 몰라도 id만으로 상세 페이지로 보낸다.
 */

import { redirect, notFound } from 'next/navigation';
import { getEventById } from '@/lib/d1';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GalleryEventRedirect({ params }: PageProps) {
  const { id } = await params;
  const eventId = parseInt(id, 10);
  if (Number.isNaN(eventId)) notFound();

  const event = await getEventById(eventId);
  if (!event) notFound();

  redirect(`/gallery/${event.year}/${encodeURIComponent(event.slug)}`);
}
