'use client';

/**
 * NewsCard Component
 * 뉴스·미디어 게시물 카드
 * - 소식/영상: 상세 페이지(/media/[id])로 이동
 * - 언론 보도(원문 링크 있음): 새 탭으로 원문 열기
 * - 영상: 대표 이미지가 없으면 YouTube 썸네일 폴백 + 재생 아이콘 오버레이
 */

import Link from 'next/link';
import Image from 'next/image';
import type { NewsPost } from '@/types/news';
import { extractYouTubeId, formatEventDateIntl } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';

interface NewsCardProps {
  post: NewsPost;
  /** 스크롤 리빌 스태거 지연(ms) — 초기 로드 카드에만 적용 */
  revealDelay?: number;
  /** "더 보기"로 추가된 카드는 리빌 없이 바로 표시 */
  reveal?: boolean;
}

export default function NewsCard({ post, revealDelay = 0, reveal = true }: NewsCardProps) {
  const { locale, messages } = useLanguage();

  const title = locale === 'ko' ? post.title_ko : (post.title_en || post.title_ko);
  const excerpt = locale === 'ko' ? post.body_ko : (post.body_en || post.body_ko);
  const categoryLabel = messages[`media.filter.${post.category}`] || post.category;
  const formattedDate = post.published_at
    ? formatEventDateIntl(post.published_at, locale)
    : '';

  const youtubeId = post.youtube_url ? extractYouTubeId(post.youtube_url) : null;
  const imageUrl =
    post.thumbnail_url ||
    (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null);

  // 언론 보도는 원문 링크로 바로 이동, 그 외(및 원문 링크 없는 보도)는 상세 페이지
  const isExternal = post.category === 'press' && !!post.external_url;

  const cardInner = (
    <>
      <div className="news-card-image">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="news-card-img"
          />
        ) : (
          <div className="news-card-placeholder" aria-hidden="true">
            <span>춤누리</span>
          </div>
        )}
        {post.category === 'video' && (
          <span className="news-card-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        )}
        <span className="news-card-badge">{categoryLabel}</span>
      </div>
      <div className="news-card-content">
        <span className="news-card-date">{formattedDate}</span>
        <h3 className="news-card-title">{title}</h3>
        {post.source_name && (
          <span className="news-card-source">{post.source_name}</span>
        )}
        {excerpt && <p className="news-card-excerpt">{excerpt}</p>}
        <span className="news-card-read-more">
          {messages['media.card.readMore'] || 'Read More'}
          <svg
            className="news-card-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            {isExternal ? (
              <path d="M7 17 17 7M9 7h8v8" />
            ) : (
              <path d="M5 12h14M12 5l7 7-7 7" />
            )}
          </svg>
        </span>
      </div>
    </>
  );

  const className = `news-card${reveal ? ' reveal reveal--up' : ''}`;
  const style = reveal && revealDelay
    ? ({ '--reveal-delay': `${revealDelay}ms` } as React.CSSProperties)
    : undefined;

  if (isExternal) {
    return (
      <a
        href={post.external_url!}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
      >
        {cardInner}
      </a>
    );
  }

  return (
    <Link href={`/media/${post.id}`} className={className} style={style}>
      {cardInner}
    </Link>
  );
}
