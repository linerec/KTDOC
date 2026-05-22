/**
 * VideoEmbed Component
 * YouTube 영상 임베드
 */

import type { EventVideo } from '@/types/gallery';
import Image from 'next/image';

interface VideoEmbedProps {
  video: EventVideo;
  autoplay?: boolean;
}

export function VideoEmbed({ video, autoplay = false }: VideoEmbedProps) {
  const embedUrl = `https://www.youtube.com/embed/${video.youtube_id}${
    autoplay ? '?autoplay=1' : ''
  }`;

  return (
    <div className="gallery-video-embed">
      <iframe
        src={embedUrl}
        title={video.title || 'YouTube Video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
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

  return (
    <div className="gallery-videos-list">
      {videos.map((video) => (
        <div key={video.id} className="gallery-video-item">
          <VideoEmbed video={video} />
          {video.title && (
            <p className="gallery-video-title">{video.title}</p>
          )}
        </div>
      ))}
    </div>
  );
}

interface VideoThumbnailProps {
  video: EventVideo;
  onClick?: () => void;
}

export function VideoThumbnail({ video, onClick }: VideoThumbnailProps) {
  const thumbnailUrl = `https://i.ytimg.com/vi/${video.youtube_id}/mqdefault.jpg`;

  return (
    <button
      type="button"
      className="gallery-video-thumbnail"
      onClick={onClick}
    >
      <Image
        src={thumbnailUrl}
        alt={video.title || 'YouTube Video'}
        width={320}
        height={180}
        className="gallery-video-thumb-img"
      />
      <div className="gallery-video-play-icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      {video.title && (
        <span className="gallery-video-thumb-title">{video.title}</span>
      )}
    </button>
  );
}

export default VideoEmbed;
