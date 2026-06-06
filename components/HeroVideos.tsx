'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import VideoCard from './VideoCard';
import { isAdmin } from '@/lib/isAdmin';
import { useBuilder } from '@/contexts/BuilderContext';
import type { YouTubeVideo } from '@/lib/youtube';

const FEATURED_KEY = 'hero.featured_video_id';

interface HeroVideosProps {
  /** 최신순으로 정렬된 후보 영상 목록 */
  videos: YouTubeVideo[];
  /** 대표(메인) 영상으로 고정된 videoId. 없으면 최신 영상이 메인. */
  featuredVideoId: string | null;
}

/**
 * 대표 영상(featuredId)을 맨 앞으로 끌어올린 표시 순서를 만든다.
 * featuredId가 없거나 목록에 없으면 원래(최신순) 순서를 그대로 사용한다.
 */
function orderVideos(videos: YouTubeVideo[], featuredId: string | null): YouTubeVideo[] {
  if (!featuredId) return videos;
  const idx = videos.findIndex((v) => v.videoId === featuredId);
  if (idx <= 0) return videos;
  return [videos[idx], ...videos.filter((_, i) => i !== idx)];
}

export default function HeroVideos({ videos, featuredVideoId }: HeroVideosProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { isEditMode } = useBuilder();

  const [mounted, setMounted] = useState(false);
  const [featuredId, setFeaturedId] = useState<string | null>(featuredVideoId);
  const [showPicker, setShowPicker] = useState(false);
  const [selected, setSelected] = useState<string | null>(featuredVideoId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setMounted(true), []);
  // 서버에서 내려준 값이 바뀌면(router.refresh 등) 로컬 상태도 동기화
  useEffect(() => setFeaturedId(featuredVideoId), [featuredVideoId]);

  const editable = isAdmin(session) && isEditMode;

  const display = useMemo(
    () => orderVideos(videos, featuredId).slice(0, 3),
    [videos, featuredId]
  );

  const openPicker = (e: React.MouseEvent) => {
    // 부모 <a target="_blank">의 새 탭 이동을 막고 편집 모달만 연다
    e.preventDefault();
    e.stopPropagation();
    setSelected(featuredId);
    setError('');
    setShowPicker(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: FEATURED_KEY, value: selected }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '저장에 실패했습니다.');
      }
      setFeaturedId(selected);
      setShowPicker(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 영상이 없으면 기존 플레이스홀더 유지
  if (display.length === 0) {
    return (
      <div className="hero-videos">
        <div className="video-card video-card-main video-placeholder">
          <span>영상 준비중</span>
        </div>
        <div className="video-card video-placeholder">
          <span>Coming Soon</span>
        </div>
        <div className="video-card video-placeholder">
          <span>Coming Soon</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hero-videos">
        <VideoCard video={display[0]} isMain>
          {editable && (
            <button
              type="button"
              className="hero-video-pick-btn"
              onClick={openPicker}
              title="대표 영상 선택"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
              </svg>
              <span>대표 영상 선택</span>
            </button>
          )}
        </VideoCard>
        {display[1] && <VideoCard video={display[1]} />}
        {display[2] && <VideoCard video={display[2]} />}
      </div>

      {showPicker && mounted && createPortal(
        <div className="image-object-modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="image-object-modal hero-video-picker" onClick={(e) => e.stopPropagation()}>
            <div className="image-object-modal-header">
              <h3>대표 영상 선택</h3>
              <button onClick={() => setShowPicker(false)}>&times;</button>
            </div>

            <div className="image-object-modal-body">
              <p className="hero-video-picker-hint">
                홈 화면 큰 썸네일로 노출할 영상을 선택하세요. 나머지 칸은 최신 영상으로 자동 채워집니다.
              </p>

              {error && <div className="intl-modal-error">{error}</div>}

              <div className="hero-video-picker-grid">
                {/* 자동(최신순) 옵션 */}
                <button
                  type="button"
                  className={`hero-video-pick-item hero-video-pick-item--auto${selected === null ? ' selected' : ''}`}
                  onClick={() => setSelected(null)}
                >
                  <div className="hero-video-pick-auto-box">
                    <span>자동<br />(최신 영상)</span>
                  </div>
                  <p className="hero-video-pick-title">최신순으로 자동 선택</p>
                </button>

                {videos.map((video) => (
                  <button
                    type="button"
                    key={video.videoId}
                    className={`hero-video-pick-item${selected === video.videoId ? ' selected' : ''}`}
                    onClick={() => setSelected(video.videoId)}
                  >
                    <div className="hero-video-pick-thumb">
                      <Image
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        sizes="180px"
                        style={{ objectFit: 'cover' }}
                      />
                      {selected === video.videoId && (
                        <span className="hero-video-pick-check">✓</span>
                      )}
                    </div>
                    <p className="hero-video-pick-title">{video.title}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="image-object-modal-footer">
              <button onClick={() => setShowPicker(false)} disabled={saving}>취소</button>
              <button onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
