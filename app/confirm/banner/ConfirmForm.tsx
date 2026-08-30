'use client';

import { useEffect, useRef, useState } from 'react';
import { NOTE_MAX } from '@/lib/print/bannerConfirm';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function ConfirmForm() {
  const [note, setNote] = useState('');
  const [website, setWebsite] = useState(''); // 허니팟 — 사람은 볼 수 없는 칸
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  // 화면이 실제로 열린 시각. 서버 렌더 시각을 쓰면 정적으로 미리 그려진 페이지에서
  // 언제나 '오래전'이 되어 봇 방어가 무력해진다.
  const openedAt = useRef(0);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === 'sending' || note.trim() === '') return;
    setStatus('sending');
    setError('');

    try {
      const response = await fetch('/api/confirm/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, website, _t: openedAt.current }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        setError(data.error || '전달되지 않았습니다.');
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setError('전달되지 않았습니다.');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <section className="cb-section cb-form" aria-live="polite">
        <h2>보내 주셔서 고맙습니다</h2>
        <p className="cb-form__done">
          알려 주신 내용이 전달되었습니다. 반영한 도안을 다시 보여 드리겠습니다.
        </p>
        <button
          type="button"
          className="cb-btn cb-btn--quiet"
          onClick={() => {
            setStatus('idle');
            setNote('');
          }}
        >
          더 알려 주실 것이 있습니다
        </button>
      </section>
    );
  }

  return (
    <section className="cb-section cb-form">
      <h2>확인 부탁드립니다</h2>
      <p className="cb-form__lede">
        고쳤으면 하는 곳, 지금 쓰시는 배너의 실제 치수, 양면으로 할지, 북 배너를 몇
        장 할지 — 편하신 대로 적어 주시면 됩니다.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <textarea
          rows={8}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="확인하신 내용"
        />

        {/* 허니팟 — 화면에서 보이지 않는다. 채워져 오면 사람이 아니다. */}
        <div className="cb-honeypot" aria-hidden="true">
          <label htmlFor="cb-website">Website</label>
          <input
            id="cb-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {status === 'error' && (
          <p className="cb-form__error" role="alert">
            {error} 잠시 뒤 다시 눌러 보시고, 그래도 안 되면 전화나 문자로 알려 주세요.
          </p>
        )}

        <button
          type="submit"
          className="cb-btn"
          disabled={status === 'sending' || note.trim() === ''}
        >
          {status === 'sending' ? '보내는 중…' : '보내기'}
        </button>
      </form>
    </section>
  );
}
