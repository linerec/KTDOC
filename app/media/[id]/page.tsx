/**
 * Media Detail Page (뉴스 & 미디어 상세)
 * 공개된 게시물만 표시. 영상은 임베드, 언론 보도는 원문 링크 제공.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNewsPostById } from '@/lib/d1';
import NewsDetail from '@/components/media/NewsDetail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const postId = parseInt(id);
  const post = isNaN(postId) ? null : await getNewsPostById(postId);

  // 루트 레이아웃의 title 템플릿('%s | KTDOC')이 접미사를 붙인다
  if (!post || !post.is_published) {
    return { title: '뉴스 & 미디어' };
  }

  return {
    title: post.title_ko,
    description: post.body_ko?.slice(0, 150) || undefined,
    alternates: { canonical: `/media/${postId}` },
  };
}

export default async function MediaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const postId = parseInt(id);

  if (isNaN(postId)) {
    notFound();
  }

  const post = await getNewsPostById(postId);

  if (!post || !post.is_published) {
    notFound();
  }

  return (
    <main className="media-page">
      <NewsDetail post={post} />
    </main>
  );
}
