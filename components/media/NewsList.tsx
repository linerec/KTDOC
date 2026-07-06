'use client';

/**
 * NewsList Component
 * 뉴스·미디어 카드 그리드 + "더 보기" 페이지네이션(공개 페이지 표준)
 */

import { useState } from 'react';
import type { NewsPost, NewsCategory } from '@/types/news';
import { useLanguage } from '@/contexts/LanguageContext';
import NewsCard from './NewsCard';
import ScrollReveal from '@/components/common/ScrollReveal';

interface NewsListProps {
  initialPosts: NewsPost[];
  total: number;
  pageSize: number;
  category?: NewsCategory;
}

export default function NewsList({
  initialPosts,
  total,
  pageSize,
  category,
}: NewsListProps) {
  const { messages } = useLanguage();
  const [posts, setPosts] = useState<NewsPost[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  // ScrollReveal은 마운트 시점의 요소만 관찰하므로 초기 로드 카드에만 리빌을 적용한다
  const [initialCount] = useState(initialPosts.length);

  const hasMore = posts.length < total;

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const nextPage = Math.floor(posts.length / pageSize) + 1;
      const qs = new URLSearchParams({
        page: String(nextPage),
        limit: String(pageSize),
      });
      if (category) qs.set('category', category);
      const res = await fetch(`/api/news?${qs.toString()}`);
      const data = await res.json();
      if (data.success) {
        const existing = new Set(posts.map((p) => p.id));
        const fresh = (data.data.posts as NewsPost[]).filter((p) => !existing.has(p.id));
        setPosts((prev) => [...prev, ...fresh]);
      }
    } catch (err) {
      console.error('뉴스 더 보기 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  if (posts.length === 0) {
    return (
      <div className="media-empty">
        <p>{messages['media.empty'] || 'No posts yet.'}</p>
      </div>
    );
  }

  return (
    <>
      <div className="news-grid">
        {posts.map((post, index) => (
          <NewsCard
            key={post.id}
            post={post}
            reveal={index < initialCount}
            revealDelay={(index % 3) * 70}
          />
        ))}
      </div>

      {hasMore && (
        <div className="media-load-more">
          <button
            type="button"
            className="media-load-more-btn"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? '...' : messages['media.loadMore'] || 'Load More'}
          </button>
        </div>
      )}

      <ScrollReveal />
    </>
  );
}
