'use client';

/**
 * YouTubeInput — 유튜브 링크를 넣는 유일한 칸
 *
 * **무엇을 고치려고 만들었나.** 예전 칸은 `https://www.youtube.com/watch?v=...` 라고
 * 적힌 빈 칸 하나였고, 맞지 않으면 "유효하지 않은 YouTube URL입니다"라고만 했다.
 * 쇼츠 주소를 붙여넣은 선생님은 무엇이 잘못됐는지 알 수 없었고, 제목은 유튜브를
 * 열어 눈으로 읽고 손으로 옮겨 적어야 했다. 'URL'이 무엇인지부터 낯선 분들에게
 * 그 화면은 '안 되는 화면'이다.
 *
 * 그래서 이 칸은 세 가지를 한다:
 *   1. **아무 모양이나 받는다** — 앱 공유 링크·쇼츠·라이브·퍼가기 코드·제목이 붙은 카톡 문장
 *      (판단은 lib/youtube/videoUrl.ts 하나가 한다)
 *   2. **붙여넣는 순간 유튜브에 물어본다** — 제목·채널·썸네일을 그림으로 보여 준다.
 *      "이 영상이 맞나?"를 글이 아니라 그림으로 확인하게 하는 것이 이 칸의 핵심이다.
 *   3. **미리 막는다** — 퍼가기가 꺼진 영상은 등록 전에 말한다. 등록 뒤에 알면
 *      올린 사람은 모르고 방문자만 깨진 화면을 본다.
 *
 * 링크를 가져오는 방법 안내는 칸 안에 접어 둔다. 별도 도움말 페이지는 아무도 안 연다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useT } from '@/lib/i18n/useT';
import {
  parseYouTube,
  YOUTUBE_PARSE_MESSAGES,
  type ResolvedYouTubeVideo,
} from '@/lib/youtube/videoUrl';
import YouTubeLinkGuide from './YouTubeLinkGuide';

interface YouTubeInputProps {
  /** 이미 저장된 주소 — 편집 화면에서 미리보기를 복원한다 */
  initialUrl?: string | null;
  /** 확인된 영상(또는 비움). 부모가 저장 방식을 정한다. */
  onResolved: (video: ResolvedYouTubeVideo | null) => void;
  /** 확인되자마자 부모가 곧바로 처리하는 경우(빠른 게시) — 미리보기를 남기지 않는다 */
  autoSubmit?: boolean;
  label?: string;
  /** 칸 아래 한 줄 설명 */
  help?: string;
  disabled?: boolean;
  /** 확인 후 비우기 — 여러 건을 연달아 넣는 화면(공연 영상)에서 쓴다 */
  clearOnResolve?: boolean;
  /** 처음 쓰는 자리면 안내를 펼쳐 둔다 — 접혀 있으면 있는 줄도 모른다 */
  guideDefaultOpen?: boolean;
  id?: string;
}

export default function YouTubeInput({
  initialUrl,
  onResolved,
  autoSubmit = false,
  label,
  help,
  disabled = false,
  clearOnResolve = false,
  guideDefaultOpen = false,
  id = 'youtube-input',
}: YouTubeInputProps) {
  const t = useT();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<ResolvedYouTubeVideo | null>(null);
  const [guideOpen, setGuideOpen] = useState(guideDefaultOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  // 같은 입력을 두 번 조회하지 않는다(붙여넣기 + change 가 겹친다)
  const lastQueried = useRef<string | null>(null);

  const resolve = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      const parsed = parseYouTube(text);
      if (!parsed.ok) {
        // 주소 모양이 아닌 것은 서버에 묻지 않는다 — 즉시 답할 수 있다.
        setVideo(null);
        onResolved(null);
        setError(t(`admin.youtube.parse.${parsed.reason}`, YOUTUBE_PARSE_MESSAGES[parsed.reason]));
        if (parsed.reason === 'notYouTube') setGuideOpen(true);
        return;
      }

      if (lastQueried.current === parsed.ref.videoId && video) return;
      lastQueried.current = parsed.ref.videoId;

      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/youtube/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: text }),
        });
        const data = await res.json();
        if (!data.success) {
          setVideo(null);
          onResolved(null);
          setError(data.error || t('admin.youtube.failed', '유튜브를 확인하지 못했습니다.'));
          return;
        }
        const found = data.data as ResolvedYouTubeVideo;
        setVideo(found);
        onResolved(found);
        if (clearOnResolve || autoSubmit) {
          setValue('');
          lastQueried.current = null;
        }
        if (autoSubmit) setVideo(null);
      } catch {
        setVideo(null);
        onResolved(null);
        setError(t('admin.youtube.network', '인터넷 연결을 확인해 주세요.'));
      } finally {
        setBusy(false);
      }
    },
    [autoSubmit, clearOnResolve, onResolved, t, video]
  );

  // 편집 화면에 들어올 때 이미 저장된 주소가 있으면 미리보기를 복원한다.
  useEffect(() => {
    if (!initialUrl || autoSubmit) return;
    const parsed = parseYouTube(initialUrl);
    if (!parsed.ok) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/youtube/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: initialUrl }),
        });
        const data = await res.json();
        if (!cancelled && data.success) {
          lastQueried.current = data.data.videoId;
          setVideo(data.data as ResolvedYouTubeVideo);
        }
      } catch {
        /* 미리보기는 있으면 좋은 것이다 — 실패해도 칸은 쓸 수 있다 */
      }
    })();
    return () => {
      cancelled = true;
    };
    // initialUrl 은 화면이 열릴 때 한 번만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => {
    setValue('');
    setVideo(null);
    setError(null);
    lastQueried.current = null;
    onResolved(null);
    inputRef.current?.focus();
  };

  return (
    <div className="yt-input">
      <label htmlFor={id} className="admin-form-label">
        {label ?? t('admin.youtube.label', '유튜브 영상 링크')}
      </label>

      <div className="yt-input-row">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="url"
          autoComplete="off"
          className="admin-form-input yt-input-field"
          placeholder={t('admin.youtube.placeholder', '여기에 붙여넣기')}
          value={value}
          disabled={disabled || busy}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onPaste={(e) => {
            // 붙여넣는 순간 확인한다 — 버튼을 한 번 더 누르게 하지 않는다.
            const pasted = e.clipboardData.getData('text');
            if (pasted.trim()) {
              e.preventDefault();
              setValue(pasted.trim());
              void resolve(pasted);
            }
          }}
          onBlur={() => {
            // 손으로 입력하거나 모바일에서 길게 눌러 붙여넣은 경우 — 칸을 벗어날 때 확인한다.
            if (value.trim() && !video && !busy) void resolve(value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void resolve(value);
            }
          }}
        />
        {value && !busy && (
          <button type="button" className="yt-input-clear" onClick={clear} aria-label={t('admin.youtube.clear', '지우기')}>
            ×
          </button>
        )}
      </div>

      {busy && (
        <p className="yt-input-status" role="status">
          {t('admin.youtube.checking', '유튜브에서 확인하는 중…')}
        </p>
      )}

      {help && !busy && <p className="admin-form-help">{help}</p>}

      <YouTubeLinkGuide open={guideOpen} onToggle={setGuideOpen} />

      {error && (
        <div className="admin-alert admin-alert-error admin-alert-sm" role="alert">
          {error}
        </div>
      )}

      {video && (
        <div className={`yt-preview${video.embeddable === false ? ' is-blocked' : ''}`}>
          <div className={`yt-preview-thumb${video.isShort ? ' is-short' : ''}`}>
            <Image src={video.thumbnail} alt="" width={160} height={90} unoptimized />
          </div>
          <div className="yt-preview-info">
            <p className="yt-preview-title">{video.title || video.videoId}</p>
            <p className="yt-preview-meta">
              {video.channelTitle && <span>{video.channelTitle}</span>}
              <span className={`yt-badge${video.isShort ? ' is-short' : ''}`}>
                {video.isShort
                  ? t('admin.youtube.vertical', '세로 영상')
                  : t('admin.youtube.horizontal', '가로 영상')}
              </span>
            </p>
            {video.embeddable === false ? (
              <p className="yt-preview-warn">
                {t(
                  'admin.youtube.notEmbeddable',
                  '이 영상은 유튜브에서 ‘퍼가기 허용’이 꺼져 있어 우리 사이트에서 재생되지 않습니다. YouTube 스튜디오 → 해당 영상 → 수정 → 모든 설정 표시 → ‘퍼가기 허용’을 켜 주세요.'
                )}
              </p>
            ) : (
              <p className="yt-preview-ok">
                {t('admin.youtube.ok', '이 영상이 맞으면 그대로 두시면 됩니다.')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
