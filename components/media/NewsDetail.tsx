'use client';

/**
 * NewsDetail Component
 * 뉴스·미디어 게시물 상세 — 영상은 YouTube 임베드, 언론 보도는 원문 링크 버튼 제공
 */

import Link from 'next/link';
import Image from 'next/image';
import type { NewsPost } from '@/types/news';
import { extractYouTubeId, formatEventDateIntl } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';

interface NewsDetailProps {
  post: NewsPost;
}

export default function NewsDetail({ post }: NewsDetailProps) {
  const { locale, messages } = useLanguage();

  const title = locale === 'ko' ? post.title_ko : (post.title_en || post.title_ko);
  const body = locale === 'ko' ? post.body_ko : (post.body_en || post.body_ko);
  const categoryLabel = messages[`media.filter.${post.category}`] || post.category;
  const formattedDate = post.published_at
    ? formatEventDateIntl(post.published_at, locale)
    : '';

  const youtubeId = post.youtube_url ? extractYouTubeId(post.youtube_url) : null;

  return (
    <article className="news-detail">
      <div className="container">
        <Link href="/media" className="news-detail-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {messages['media.detail.back'] || 'Back to List'}
        </Link>

        <div className="news-detail-meta">
          <span className="news-detail-badge">{categoryLabel}</span>
          {formattedDate && <span className="news-detail-date">{formattedDate}</span>}
          {post.source_name && (
            <span className="news-detail-source">
              {messages['media.detail.source'] || 'Source'}: {post.source_name}
            </span>
          )}
        </div>

        <h1 className="news-detail-title">{title}</h1>

        {youtubeId ? (
          <div className="news-detail-video">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : post.thumbnail_url ? (
          <div className="news-detail-image">
            <Image
              src={post.thumbnail_url}
              alt={title}
              fill
              sizes="(max-width: 900px) 100vw, 860px"
              className="news-detail-img"
              priority
            />
          </div>
        ) : null}

        {body && <div className="news-detail-body">{body}</div>}

        {(post.external_url || post.youtube_url) && (
          <div className="news-detail-actions">
            {post.external_url && (
              <a
                href={post.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-detail-link-btn"
              >
                {messages['media.detail.externalLink'] || 'Read Original Article'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </a>
            )}
            {post.youtube_url && (
              <a
                href={post.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-detail-link-btn news-detail-link-btn-outline"
              >
                {messages['media.detail.watchOnYoutube'] || 'Watch on YouTube'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
