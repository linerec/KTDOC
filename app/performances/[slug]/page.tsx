/**
 * Performance detail alias
 * /performances/[slug] 는 정식(canonical) 상세인 /gallery/[year]/[slug] 로 영구 연결.
 * (공연 데이터는 events 테이블을 공유하므로 상세는 하나만 유지)
 */

import { redirect, notFound } from 'next/navigation';
import { queryD1 } from '@/lib/d1/client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PerformanceSlugRedirect({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  const rows = await queryD1<{ year: number; slug: string }>(
    'SELECT year, slug FROM events WHERE slug = ? AND is_published = 1 LIMIT 1',
    [decoded]
  );

  const event = rows[0];
  if (!event) {
    notFound();
  }

  redirect(`/gallery/${event.year}/${event.slug}`);
}
