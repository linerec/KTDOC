'use client';

/**
 * QuickVideoPaste — 유튜브 링크를 붙여넣으면 영상 게시물이 바로 게시된다
 *
 * 뉴스 관리 목록 상단의 한 칸. 붙여넣는 순간(paste) 곧바로 보내고, 손으로 친 경우는
 * Enter나 버튼으로 보낸다. 제목·게시일은 서버가 유튜브에서 가져온다
 * (/api/admin/news/quick-video). 성공하면 목록을 새로 그리고 결과 줄에 제목과
 * 편집 링크를 남긴다 — 제목을 고치고 싶으면 거기서 고친다.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/useT';
import { parseYouTube, YOUTUBE_PARSE_MESSAGES } from '@/lib/youtube/videoUrl';
import YouTubeLinkGuide from '@/components/admin/YouTubeLinkGuide';

interface Result {
  id: number;
  title_ko: string;
  existing: boolean;
}

export default function QuickVideoPaste() {
  const t = useT();
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setError(null);
    setResult(null);

    const parsed = parseYouTube(text);
    if (!parsed.ok) {
      // 무엇을 붙여넣었는지에 맞춰 말한다 — "유튜브 링크가 아닙니다" 한 줄로는
      // 재생목록을 넣었는지 채널을 넣었는지 본인도 알 수 없다.
      setError(t(`admin.youtube.parse.${parsed.reason}`, YOUTUBE_PARSE_MESSAGES[parsed.reason]));
      setGuideOpen(true);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/admin/news/quick-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: text }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.news.quick.failed', '영상 게시물을 만들지 못했습니다.'));
      }
      setResult(data.data as Result);
      setValue('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="quick-video">
      <form
        className="quick-video-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(value);
        }}
      >
        <label htmlFor="quick-video-url" className="quick-video-label">
          {t('admin.news.quick.label', '유튜브 링크 붙여넣기')}
        </label>
        <div className="quick-video-row">
          <input
            ref={inputRef}
            id="quick-video-url"
            type="text"
            inputMode="url"
            className="admin-filter-input quick-video-input"
            placeholder="여기에 붙여넣기"
            value={value}
            disabled={busy}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onPaste={(e) => {
              // 붙여넣는 순간 보낸다 — 이 칸의 존재 이유. 입력값 반영보다 먼저 오므로 클립보드에서 읽는다.
              const pasted = e.clipboardData.getData('text');
              if (pasted.trim()) {
                e.preventDefault();
                setValue(pasted.trim());
                void submit(pasted);
              }
            }}
          />
          <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm" disabled={busy || !value.trim()}>
            {busy
              ? t('admin.news.quick.busy', '유튜브에서 가져오는 중…')
              : t('admin.news.quick.submit', '바로 게시')}
          </button>
        </div>
        <YouTubeLinkGuide open={guideOpen} onToggle={setGuideOpen} />
        <p className="quick-video-help">
          {t(
            'admin.news.quick.help',
            '제목과 게시일은 유튜브에서 가져와 영상 게시물로 바로 게시됩니다. 제목을 바꾸려면 게시 뒤 편집하세요.'
          )}
        </p>
      </form>

      {error && (
        <div className="admin-alert admin-alert-error admin-alert-sm" role="alert">
          {error}
        </div>
      )}
      {result && (
        <div className="admin-alert admin-alert-success admin-alert-sm" role="status">
          {result.existing
            ? t('admin.news.quick.existing', '이미 올라온 영상입니다')
            : t('admin.news.quick.done', '게시됐습니다')}
          {' — '}
          <strong>{result.title_ko}</strong>
          {' · '}
          <Link href={`/admin/news/${result.id}`}>{t('admin.news.quick.edit', '편집')}</Link>
          {' · '}
          <Link href={`/media/${result.id}`} target="_blank" rel="noreferrer">
            {t('admin.news.quick.view', '공개 페이지')}
          </Link>
        </div>
      )}
    </div>
  );
}
