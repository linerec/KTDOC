'use client';

/**
 * VideoEmbed — 공개 화면의 유튜브 재생
 *
 * 두 가지를 고쳤다.
 *
 * **1. 세로 영상.** 상자가 16:9로 박혀 있어서 쇼츠를 넣으면 양옆에 검은 띠를 두른
 * 우표만 한 영상이 됐다. 이제 저장된 주소가 쇼츠면 9:16으로 세우고 폭을 제한한다
 * (세로 영상이 화면을 통째로 차지하지 않게). 판단 근거는 주소 하나뿐이다 —
 * lib/youtube/videoUrl.ts의 isShortUrl. 그래서 쇼츠는 쇼츠 주소로 저장한다.
 *
 * **2. 누르기 전에는 유튜브를 부르지 않는다.** 예전에는 영상 수만큼 iframe이 떠서,
 * 방문자가 재생을 누르지 않아도 페이지마다 수백 KB의 유튜브 스크립트와 여러 개의
 * 연결이 붙었다. 이제 처음에는 썸네일 한 장(15KB 남짓)만 두고, 누르는 순간 재생기를
 * 끼운다. 한 페이지에 영상이 여럿인 공연 상세에서 체감이 크다.
 * (facade 패턴 — paulirish/lite-youtube-embed가 같은 방식이다)
 *
 * 누르기 전에는 유튜브를 아예 부르지 않으므로 쿠키도 없다 — 프라이버시는 이 facade가
 * 지킨다. (재생기 도메인은 youtube.com이다. youtube-nocookie.com은 재생을 누르는
 * 순간 "봇이 아님을 확인하세요"로 막힌다 — lib/youtube/videoUrl.ts의 youtubeEmbedUrl 주석)
 */

import { useState } from 'react';
import Image from 'next/image';
import type { EventVideo } from '@/types/gallery';
import { isShortUrl, youtubeEmbedUrl, youtubeThumbnail } from '@/lib/youtube/videoUrl';

interface VideoEmbedProps {
  video: EventVideo;
  /** 처음부터 재생기를 붙인다(라이트박스처럼 이미 누르고 들어온 자리) */
  autoplay?: boolean;
}

export function VideoEmbed({ video, autoplay = false }: VideoEmbedProps) {
  const [playing, setPlaying] = useState(autoplay);
  const vertical = isShortUrl(video.youtube_url);
  const label = video.title || 'YouTube';

  return (
    <div className={`gallery-video-embed${vertical ? ' is-short' : ''}`}>
      {playing ? (
        <iframe
          src={youtubeEmbedUrl(video.youtube_id, { autoplay: true })}
          title={label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <button
          type="button"
          className="gallery-video-facade"
          onClick={() => setPlaying(true)}
          aria-label={`${label} — 재생`}
        >
          <Image
            src={youtubeThumbnail(video.youtube_id, vertical ? 'hq' : 'maxres')}
            alt=""
            fill
            sizes={vertical ? '320px' : '(max-width: 860px) 100vw, 560px'}
            className="gallery-video-facade-img"
            unoptimized
          />
          <span className="gallery-video-facade-play" aria-hidden="true">
            <svg viewBox="0 0 68 48">
              <path
                d="M66.5 7.7c-.8-2.9-2.5-5.4-5.4-6.2C55.8.1 34 0 34 0S12.2.1 6.9 1.5C4 2.3 2.3 4.8 1.5 7.7 0 13.1 0 24 0 24s0 10.9 1.5 16.3c.8 2.9 2.5 5.4 5.4 6.2C12.2 47.9 34 48 34 48s21.8-.1 27.1-1.5c2.9-.8 4.6-3.3 5.4-6.2C68 34.9 68 24 68 24s0-10.9-1.5-16.3z"
                fill="#f00"
              />
              <path d="M45 24 27 14v20" fill="#fff" />
            </svg>
          </span>
        </button>
      )}

      {/* 퍼가기가 막힌 영상은 재생기가 오류만 띄운다. 언제나 유튜브로 갈 길을 남긴다. */}
      <a
        className="gallery-video-fallback"
        href={video.youtube_url}
        target="_blank"
        rel="noopener noreferrer"
      >
        YouTube에서 보기
      </a>
    </div>
  );
}

interface VideoListProps {
  videos: EventVideo[];
  locale?: 'ko' | 'en';
}

export function VideoList({ videos, locale = 'ko' }: VideoListProps) {
  if (videos.length === 0) {
    return (
      <div className="gallery-videos-empty">
        <p>{locale === 'ko' ? '등록된 영상이 없습니다.' : 'No videos available.'}</p>
      </div>
    );
  }

  // 첫 영상은 전폭으로 세운다 — 여러 편이어도 '대표 한 편'이 먼저 눈에 들어와야 한다.
  // (영상이 일곱 편인 공연도 있다. 전부 같은 크기로 늘어놓으면 어느 것부터 볼지 알 수 없다)
  const [lead, ...rest] = videos;

  return (
    <>
      <div className="gallery-video-lead">
        <div className={`gallery-video-item${isShortUrl(lead.youtube_url) ? ' is-short' : ''}`}>
          <VideoEmbed video={lead} />
          {lead.title && <p className="gallery-video-title">{lead.title}</p>}
        </div>
      </div>

      {rest.length > 0 && (
        <div className="gallery-videos-list">
          {rest.map((video) => (
            <div
              key={video.id}
              className={`gallery-video-item${isShortUrl(video.youtube_url) ? ' is-short' : ''}`}
            >
              <VideoEmbed video={video} />
              {video.title && <p className="gallery-video-title">{video.title}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

interface VideoThumbnailProps {
  video: EventVideo;
  onClick?: () => void;
}

export function VideoThumbnail({ video, onClick }: VideoThumbnailProps) {
  return (
    <button type="button" className="gallery-video-thumbnail" onClick={onClick}>
      <Image
        src={youtubeThumbnail(video.youtube_id, 'mq')}
        alt={video.title || 'YouTube Video'}
        width={320}
        height={180}
        className="gallery-video-thumb-img"
        unoptimized
      />
      <div className="gallery-video-play-icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      {video.title && <span className="gallery-video-thumb-title">{video.title}</span>}
    </button>
  );
}

export default VideoEmbed;
