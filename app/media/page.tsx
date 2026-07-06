/**
 * Media Page (뉴스 & 미디어)
 * 소식·언론 보도·영상 게시물 목록 — 분류 필터 + "더 보기" 페이지네이션
 */

import type { Metadata } from 'next';
import { getNewsPosts } from '@/lib/d1';
import { isNewsCategory } from '@/types/news';
import MediaHero from '@/components/media/MediaHero';
import MediaFilter from '@/components/media/MediaFilter';
import NewsList from '@/components/media/NewsList';

export const metadata: Metadata = {
  // 루트 레이아웃의 title 템플릿('%s | KTDOC')이 접미사를 붙인다
  title: '뉴스 & 미디어',
  description:
    '한국전통무용문화원 춤누리의 소식, 언론 보도, 공연 영상을 한곳에서 확인하세요.',
  alternates: {
    canonical: '/media',
  },
  openGraph: {
    title: '뉴스 & 미디어 | KTDOC',
    description:
      '한국전통무용문화원 춤누리의 소식, 언론 보도, 공연 영상을 한곳에서 확인하세요.',
    url: '/media',
    images: [
      {
        url: '/og-image.jpg',
        width: 600,
        height: 400,
        alt: 'KTDOC - Korean Traditional Dance of Choomnoori',
      },
    ],
  },
};

const PAGE_SIZE = 9;

interface PageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function MediaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category = isNewsCategory(params.category) ? params.category : undefined;

  const { posts, total } = await getNewsPosts({
    category,
    page: 1,
    limit: PAGE_SIZE,
    published: true,
  });

  return (
    <main className="media-page">
      <MediaHero />

      <section className="media-main">
        <div className="container">
          <MediaFilter active={category} />
          {/* key로 필터 변경 시 클라이언트 목록 상태(더 보기 누적분)를 초기화한다 */}
          <NewsList
            key={category ?? 'all'}
            initialPosts={posts}
            total={total}
            pageSize={PAGE_SIZE}
            category={category}
          />
        </div>
      </section>
    </main>
  );
}
