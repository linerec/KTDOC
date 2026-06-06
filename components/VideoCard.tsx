import Image from 'next/image';
import Link from 'next/link';
import type { YouTubeVideo } from '@/lib/youtube';

interface VideoCardProps {
  video: YouTubeVideo;
  isMain?: boolean;
  /** 카드 위에 겹쳐 그릴 추가 요소 (예: 관리자 편집 버튼) */
  children?: React.ReactNode;
}

export default function VideoCard({ video, isMain = false, children }: VideoCardProps) {
  return (
    <Link
      href={`https://www.youtube.com/watch?v=${video.videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`video-card ${isMain ? 'video-card-main' : ''}`}
    >
      <div className="video-card-thumbnail">
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          style={{ objectFit: 'cover' }}
          sizes={isMain ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 50vw, 25vw'}
        />
      </div>
      <div className="video-card-overlay">
        <svg
          className="play-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <div className="video-card-info">
        <p className="video-card-title">{video.title}</p>
      </div>
      {children}
    </Link>
  );
}
