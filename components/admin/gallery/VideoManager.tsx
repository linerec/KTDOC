'use client';

/**
 * VideoManager Component
 * YouTube 영상 관리
 */

import { useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import Image from 'next/image';
import type { EventVideo } from '@/types/gallery';

interface VideoManagerProps {
  eventId: number;
  videos: EventVideo[];
  onAdd: (video: EventVideo) => void;
  onDelete: (videoId: number) => void;
}

export default function VideoManager({
  eventId,
  videos,
  onAdd,
  onDelete,
}: VideoManagerProps) {
  const t = useT();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!youtubeUrl.trim()) return;

    setError(null);
    setAdding(true);

    try {
      const res = await fetch(
        `/api/admin/gallery/events/${eventId}/videos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            youtube_url: youtubeUrl.trim(),
            title: title.trim() || undefined,
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || t('admin.videos.addFailed', '영상 추가에 실패했습니다.'));
      }

      // Create video object for local state
      const youtubeId = extractYouTubeId(youtubeUrl);
      onAdd({
        id: data.data.id,
        event_id: eventId,
        youtube_url: youtubeUrl,
        youtube_id: youtubeId || '',
        title: title || null,
        sort_order: videos.length,
        created_at: new Date().toISOString(),
      });

      setYoutubeUrl('');
      setTitle('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.videos.addFailed', '영상 추가에 실패했습니다.')
      );
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (videoId: number) => {
    if (!confirm(t('admin.videos.deleteConfirm', '이 영상을 삭제하시겠습니까?'))) return;

    setDeleting(videoId);
    try {
      const res = await fetch(
        `/api/admin/gallery/events/${eventId}/videos?videoId=${videoId}`,
        { method: 'DELETE' }
      );

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || t('admin.common.deleteFailed', '삭제에 실패했습니다.'));
      }

      onDelete(videoId);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : t('admin.common.deleteFailed', '삭제에 실패했습니다.')
      );
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="admin-video-manager">
      {/* Add Video */}
      <div className="admin-video-form">
        <div className="admin-form-group">
          <label htmlFor="youtube_url" className="admin-form-label">
            YouTube URL
          </label>
          <input
            type="text"
            id="youtube_url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="admin-form-input"
          />
        </div>

        <div className="admin-form-group">
          <label htmlFor="video_title" className="admin-form-label">
            {t('admin.videos.titleOptional', '제목 (선택)')}
          </label>
          <input
            type="text"
            id="video_title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('admin.videos.titlePlaceholder', '영상 제목')}
            className="admin-form-input"
          />
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={adding || !youtubeUrl.trim()}
          onClick={handleAdd}
        >
          {adding ? t('admin.videos.adding', '추가 중...') : t('admin.videos.add', '영상 추가')}
        </button>
      </div>

      {error && (
        <div className="admin-alert admin-alert-error admin-alert-sm">
          {error}
        </div>
      )}

      {/* Video List */}
      {videos.length > 0 && (
        <div className="admin-video-list">
          {videos.map((video) => (
            <div key={video.id} className="admin-video-item">
              <div className="admin-video-thumb">
                <Image
                  src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                  alt={video.title || 'YouTube Video'}
                  width={160}
                  height={90}
                />
                <a
                  href={video.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-video-play"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </a>
              </div>
              <div className="admin-video-info">
                <p className="admin-video-title">
                  {video.title || video.youtube_id}
                </p>
                <a
                  href={video.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-video-url"
                >
                  {video.youtube_url}
                </a>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-danger"
                onClick={() => handleDelete(video.id)}
                disabled={deleting === video.id}
              >
                {deleting === video.id ? '...' : t('admin.common.delete', '삭제')}
              </button>
            </div>
          ))}
        </div>
      )}

      {videos.length === 0 && (
        <p className="admin-empty-hint">{t('admin.videos.empty', '등록된 영상이 없습니다.')}</p>
      )}
    </div>
  );
}

// Helper function to extract YouTube ID
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /youtube\.com\/v\/([^&\s?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}
