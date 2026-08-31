'use client';

/**
 * 열린 자료함 — 공연장에서 실제로 쓰는 화면
 *
 * 예쁨보다 **안 깨지는 것**이 먼저다. 무대 뒤 어두운 곳에서 태블릿을 쥔 사람이
 * 한 손으로 누를 수 있어야 하고, 인터넷이 느려도 첫 곡이 나와야 한다.
 *
 * 그래서 플레이어를 직접 만들지 않고 브라우저 기본 <audio controls>를 쓴다.
 * 진행바·볼륨·배속이 기기마다 이미 익숙한 모양으로 있고, 우리가 만든 것보다
 * 접근성이 낫다. 우리가 얹는 것은 큰 재생 버튼과 목록뿐이다.
 *
 * <audio>는 **하나만** 둔다. 다른 곡을 누르면 src가 바뀌므로 이전 곡이 저절로
 * 멈춘다 — 두 곡이 겹쳐 나오는 사고가 구조적으로 불가능하다.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import type { ResourceItemPublic } from '@/types/resources';

interface Props {
  code: string;
  title: string;
  note: string | null;
  allowDownload: boolean;
  allowEmail: boolean;
  items: ResourceItemPublic[];
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))}KB`;
}

function kindOf(contentType: string): 'audio' | 'pdf' | 'image' | 'file' {
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('image/')) return 'image';
  return 'file';
}

export default function ResourceVaultView({
  code,
  title,
  note,
  allowDownload,
  allowEmail,
  items,
}: Props) {
  const t = useT();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [mailNote, setMailNote] = useState<{ ok: boolean; text: string } | null>(null);

  const fileUrl = useCallback(
    (itemId: number, download = false) =>
      `/api/resources/${code}/items/${itemId}/file${download ? '?dl=1' : ''}`,
    [code]
  );

  const play = useCallback(
    (item: ResourceItemPublic) => {
      const el = audioRef.current;
      if (!el) return;
      if (playingId === item.id && !el.paused) {
        el.pause();
        return;
      }
      if (playingId !== item.id) {
        el.src = fileUrl(item.id);
        setPlayingId(item.id);
      }
      void el.play().catch(() => {
        // 자동재생 정책이나 네트워크로 막힌 경우 — 컨트롤이 그대로 남으니
        // 사람이 다시 누를 수 있다. 조용히 넘긴다.
      });
    },
    [fileUrl, playingId]
  );

  const sendLink = useCallback(async () => {
    const address = email.trim();
    if (!address) return;
    setSending(true);
    setMailNote(null);
    try {
      const res = await fetch(`/api/resources/${code}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) {
        setEmail('');
        setMailNote({
          ok: true,
          text: t('resources.email.sent', '보냈습니다. 메일함을 확인해 주세요.'),
        });
      } else {
        setMailNote({
          ok: false,
          text: data?.error ?? t('resources.email.failed', '보내지 못했습니다.'),
        });
      }
    } catch {
      setMailNote({
        ok: false,
        text: t('resources.email.failed', '보내지 못했습니다.'),
      });
    } finally {
      setSending(false);
    }
  }, [code, email, t]);

  const nowPlaying = useMemo(
    () => items.find((item) => item.id === playingId) ?? null,
    [items, playingId]
  );

  return (
    <section className="rv-vault">
      <header className="rv-vault__head">
        <p className="rv-vault__code">{code}</p>
        <h1 className="rv-vault__title">{title}</h1>
        {note ? <p className="rv-vault__note">{note}</p> : null}
      </header>

      {items.length === 0 ? (
        <p className="rv-vault__empty">
          {t('resources.empty', '아직 올라온 자료가 없습니다.')}
        </p>
      ) : (
        <ol className="rv-list">
          {items.map((item, index) => {
            const kind = kindOf(item.contentType);
            const isPlaying = playingId === item.id;
            return (
              <li className={`rv-item${isPlaying ? ' is-playing' : ''}`} key={item.id}>
                <span className="rv-item__no" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="rv-item__body">
                  <span className="rv-item__title">{item.title}</span>
                  <span className="rv-item__meta">
                    {formatDuration(item.durationSeconds) &&
                      `${formatDuration(item.durationSeconds)} · `}
                    {formatSize(item.sizeBytes)}
                  </span>
                </span>
                <span className="rv-item__acts">
                  {kind === 'audio' ? (
                    <button
                      type="button"
                      className="rv-play"
                      onClick={() => play(item)}
                      aria-label={
                        isPlaying
                          ? t('resources.pause', '멈춤')
                          : `${t('resources.play', '재생')}: ${item.title}`
                      }
                    >
                      {isPlaying ? '❙❙' : '▶'}
                    </button>
                  ) : (
                    <a
                      className="rv-play rv-play--open"
                      href={fileUrl(item.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${t('resources.open', '열기')}: ${item.title}`}
                    >
                      ↗
                    </a>
                  )}
                  {allowDownload ? (
                    <a
                      className="rv-get"
                      href={fileUrl(item.id, true)}
                      aria-label={`${t('resources.download', '내려받기')}: ${item.title}`}
                    >
                      ⭳
                    </a>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* 플레이어는 하나뿐이다 — 두 곡이 겹쳐 나올 수 없는 이유 */}
      <div className={`rv-player${nowPlaying ? ' is-on' : ''}`}>
        {nowPlaying ? <p className="rv-player__now">{nowPlaying.title}</p> : null}
        <audio
          ref={audioRef}
          controls
          preload="none"
          className="rv-audio"
          onEnded={() => setPlayingId(null)}
        />
      </div>

      {allowEmail ? (
        <div className="rv-mail">
          <label className="rv-mail__label" htmlFor="rv-mail-input">
            {t('resources.email.label', '이메일로 받기')}
          </label>
          <p className="rv-mail__hint">
            {t(
              'resources.email.hint',
              '주소를 넣으시면 비밀번호 없이 열리는 링크를 보내 드립니다. 링크는 24시간 뒤 만료됩니다.'
            )}
          </p>
          <div className="rv-mail__row">
            <input
              id="rv-mail-input"
              className="rv-mail__input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={sending}
            />
            <button
              type="button"
              className="rv-mail__send"
              onClick={sendLink}
              disabled={sending || !email.trim()}
            >
              {sending ? t('resources.email.sending', '보내는 중…') : t('resources.email.send', '보내기')}
            </button>
          </div>
          {mailNote ? (
            <p className={`rv-mail__note${mailNote.ok ? ' is-ok' : ' is-bad'}`} role="status">
              {mailNote.text}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="rv-vault__legal">
        {t(
          'resources.legal',
          '이 자료의 저작권은 학원과 원저작자에게 있습니다. 공연 목적 외로 쓰거나 다시 공유하지 말아 주세요.'
        )}
      </p>
    </section>
  );
}
