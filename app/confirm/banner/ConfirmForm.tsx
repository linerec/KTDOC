'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BANNER_QUESTIONS,
  BANNER_SIZE_FIELDS,
  NOTE_MAX,
  SENDER_MAX,
  SHORT_MAX,
} from '@/lib/print/bannerConfirm';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function ConfirmForm() {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [sender, setSender] = useState('');
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
    if (status === 'sending') return;
    setStatus('sending');
    setError('');

    try {
      const response = await fetch('/api/confirm/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          choices,
          sizes,
          note,
          sender,
          website,
          _t: openedAt.current,
        }),
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
            setChoices({});
            setSizes({});
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
        아시는 것만 답해 주셔도 됩니다. 모르는 항목은 비워 두시면 됩니다.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {BANNER_QUESTIONS.map((question) => (
          <fieldset key={question.key} className="cb-field">
            <legend className="cb-field__label">{question.label}</legend>
            {question.help && <p className="cb-field__help">{question.help}</p>}
            <div className="cb-choices">
              {question.options.map((option) => (
                <label key={option.value} className="cb-choice">
                  <input
                    type="radio"
                    name={question.key}
                    value={option.value}
                    checked={choices[question.key] === option.value}
                    onChange={() =>
                      setChoices((prev) => ({ ...prev, [question.key]: option.value }))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <fieldset className="cb-field">
          <legend className="cb-field__label">실측 치수</legend>
          <p className="cb-field__help">
            지금 쓰시는 배너를 재 주시면 도안이 확정됩니다. 위 치수는 사진으로 어림한
            값입니다.
          </p>
          <div className="cb-sizes">
            {BANNER_SIZE_FIELDS.map((field) => (
              <label key={field.key} className="cb-size">
                <span className="cb-size__label">{field.label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  maxLength={SHORT_MAX}
                  placeholder={field.placeholder}
                  value={sizes[field.key] ?? ''}
                  onChange={(e) =>
                    setSizes((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="cb-field">
          <label className="cb-field__label" htmlFor="cb-note">
            그 밖에 하실 말씀
          </label>
          <textarea
            id="cb-note"
            rows={5}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="고쳤으면 하는 곳, 넣고 싶은 문구, 인쇄소에서 들으신 이야기 무엇이든"
          />
        </div>

        <div className="cb-field cb-field--inline">
          <label className="cb-field__label" htmlFor="cb-sender">
            보내시는 분
          </label>
          <input
            id="cb-sender"
            type="text"
            maxLength={SENDER_MAX}
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="성함"
          />
        </div>

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

        <button type="submit" className="cb-btn" disabled={status === 'sending'}>
          {status === 'sending' ? '보내는 중…' : '보내기'}
        </button>
      </form>
    </section>
  );
}
