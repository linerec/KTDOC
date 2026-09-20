'use client';

/**
 * VideoManager — 공연에 유튜브 영상을 붙인다
 *
 * 링크를 받고 확인하는 일은 전부 YouTubeInput이 한다(네 화면이 같은 칸을 쓴다).
 * 여기가 하는 일은 확인된 영상을 이 공연에 붙이고, 붙은 것들을 보여 주는 것뿐이다.
 *
 * 제목 칸은 없앴다. 유튜브가 이미 붙여 둔 제목을 사람이 다시 옮겨 적을 이유가 없고,
 * 비워 두면 ID가 그대로 노출되던 자리다. 다르게 부르고 싶을 때만 고쳐 쓰게 한다.
 */

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import Image from 'next/image';
import type { EventVideo } from '@/types/gallery';
import type { ResolvedYouTubeVideo } from '@/lib/youtube/videoUrl';
import { isShortUrl, youtubeThumbnail } from '@/lib/youtube/videoUrl';
import YouTubeInput from '@/components/admin/YouTubeInput';

interface VideoManagerProps {
  eventId: number;
  videos: EventVideo[];
  onAdd: (video: EventVideo) => void;
  onDelete: (videoId: number) => void;
}

export default function VideoManager({ eventId, videos, onAdd, onDelete }: VideoManagerProps) {
  const t = useT();
  const [found, setFound] = useState<ResolvedYouTubeVideo | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 이미 등록된 영상 중 유튜브에서 '퍼가기 허용'이 꺼진 것 — 방문자에게만 보이는 고장이다 */
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  // 목록이 바뀔 때마다 한 번 묻는다(Data API 한 번에 최대 50건).
  const idKey = videos.map((v) => v.youtube_id).join(',');
  useEffect(() => {
    const ids = idKey.split(',').filter(Boolean);
    if (ids.length === 0) {
      setBlocked(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/youtube/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
        const data = await res.json();
        if (cancelled || !data.success) return;
        const bad = new Set<string>();
        for (const [id, info] of Object.entries(
          data.data as Record<string, { found: boolean; embeddable: boolean | null }>
        )) {
          if (info.embeddable === false || info.found === false) bad.add(id);
        }
        setBlocked(bad);
      } catch {
        /* 점검은 있으면 좋은 것이다 — 실패해도 화면은 그대로 쓴다 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idKey]);

  const alreadyAdded = found ? videos.some((v) => v.youtube_id === found.videoId) : false;

  const handleAdd = async () => {
    if (!found || alreadyAdded) return;
    setError(null);
    setAdding(true);
    try {
      const title = customTitle.trim() || found.title.trim() || null;
      const res = await fetch(`/api/admin/gallery/events/${eventId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: found.canonicalUrl, title: title || undefined }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.videos.addFailed', '영상 추가에 실패했습니다.'));
      }

      onAdd({
        id: data.data.id,
        event_id: eventId,
        youtube_url: found.canonicalUrl,
        youtube_id: found.videoId,
        title,
        sort_order: videos.length,
        created_at: new Date().toISOString(),
      });

      setFound(null);
      setCustomTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.videos.addFailed', '영상 추가에 실패했습니다.'));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (videoId: number) => {
    if (!confirm(t('admin.videos.deleteConfirm', '이 영상을 삭제하시겠습니까?'))) return;
    setDeleting(videoId);
    try {
      const res = await fetch(`/api/admin/gallery/events/${eventId}/videos?videoId=${videoId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.deleteFailed', '삭제에 실패했습니다.'));
      }
      onDelete(videoId);
    } catch (err) {
      alert(err instanceof Error ? err.message : t('admin.common.deleteFailed', '삭제에 실패했습니다.'));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="admin-video-manager">
      <div className="admin-video-form">
        <YouTubeInput
          id="event-video-url"
          onResolved={(v) => {
            setFound(v);
            setCustomTitle('');
            setError(null);
          }}
        />

        {found && (
          <>
            <div className="admin-form-group">
              <label htmlFor="video_title" className="admin-form-label">
                {t('admin.videos.titleOptional', '제목 (비워 두면 유튜브 제목을 씁니다)')}
              </label>
              <input
                type="text"
                id="video_title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={found.title}
                className="admin-form-input"
              />
            </div>

            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={adding || alreadyAdded}
              onClick={handleAdd}
            >
              {alreadyAdded
                ? t('admin.videos.already', '이미 추가된 영상입니다')
                : adding
                  ? t('admin.videos.adding', '추가 중...')
                  : t('admin.videos.add', '이 영상 추가')}
            </button>
          </>
        )}
      </div>

      {error && <div className="admin-alert admin-alert-error admin-alert-sm">{error}</div>}

      {videos.length > 0 && (
        <div className="admin-video-list">
          {videos.map((video) => {
            const vertical = isShortUrl(video.youtube_url);
            const isBlocked = blocked.has(video.youtube_id);
            return (
              <div key={video.id} className={`admin-video-item${isBlocked ? ' is-blocked' : ''}`}>
                <div className={`admin-video-thumb${vertical ? ' is-short' : ''}`}>
                  <Image
                    src={youtubeThumbnail(video.youtube_id, 'mq')}
                    alt={video.title || 'YouTube'}
                    width={160}
                    height={90}
                    unoptimized
                  />
                  <a
                    href={video.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-video-play"
                    aria-label={t('admin.videos.openOnYoutube', '유튜브에서 열기')}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </a>
                </div>
                <div className="admin-video-info">
                  <p className="admin-video-title">{video.title || video.youtube_id}</p>
                  <p className="admin-video-meta">
                    <span className={`yt-badge${vertical ? ' is-short' : ''}`}>
                      {vertical
                        ? t('admin.youtube.vertical', '세로 영상')
                        : t('admin.youtube.horizontal', '가로 영상')}
                    </span>
                    <a
                      href={video.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-video-url"
                    >
                      {t('admin.videos.openOnYoutube', '유튜브에서 열기')}
                    </a>
                  </p>
                  {isBlocked && (
                    <p className="admin-video-warn">
                      {t(
                        'admin.videos.blocked',
                        '이 영상은 공개 페이지에서 재생되지 않습니다. 유튜브에서 지워졌거나 ‘퍼가기 허용’이 꺼져 있습니다 — YouTube 스튜디오 → 해당 영상 → 수정 → 모든 설정 표시 → ‘퍼가기 허용’을 켜 주세요.'
                      )}
                    </p>
                  )}
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
            );
          })}
        </div>
      )}

      {videos.length === 0 && (
        <p className="admin-empty-hint">{t('admin.videos.empty', '등록된 영상이 없습니다.')}</p>
      )}
    </div>
  );
}
