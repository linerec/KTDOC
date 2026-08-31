'use client';

/**
 * 자료함 잠금 화면 — 무대 뒤에서 태블릿으로 누르는 키패드
 *
 * 공연장에는 키보드가 없을 때가 많다. 그래서 화면에 숫자판을 띄우되, 노트북으로
 * 들어온 사람을 위해 물리 키보드도 함께 받는다. 두 입력이 같은 상태를 만진다.
 *
 * 화면이 **말하지 않는 것**들에 뜻이 있다:
 *  - 자료함 제목: 번호만 우연히 맞춘 사람에게 여기 뭐가 있는지 알리지 않는다
 *  - 비밀번호 자릿수: 빈 칸을 미리 그리지 않는다(누른 만큼만 ● 가 는다)
 *  - 남은 시도 횟수: 공격자에게 주는 힌트다
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/useT';
import { PASSCODE_MAX, PASSCODE_MIN } from '@/lib/resources/passcode';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function ResourceLockScreen({ code }: { code: string }) {
  const t = useT();
  const router = useRouter();
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [message, setMessage] = useState('');
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
  }, []);

  const fail = useCallback((text: string) => {
    setMessage(text);
    setWrong(true);
    setDigits('');
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setWrong(false), 320);
  }, []);

  const submit = useCallback(
    async (value: string) => {
      if (value.length < PASSCODE_MIN) {
        fail(t('resources.lock.tooShort', `${PASSCODE_MIN}자리 이상 눌러 주세요.`));
        return;
      }
      setBusy(true);
      setMessage('');
      try {
        const res = await fetch(`/api/resources/${code}/unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: value }),
        });
        if (res.ok) {
          setDigits('');
          router.refresh();
          return;
        }
        if (res.status === 429) {
          fail(t('resources.lock.blocked', '잠시 후 다시 시도해 주세요.'));
          return;
        }
        fail(t('resources.lock.wrong', '다시 확인해 주세요.'));
      } catch {
        fail(t('resources.lock.network', '연결이 불안정합니다. 다시 시도해 주세요.'));
      } finally {
        setBusy(false);
      }
    },
    [code, fail, router, t]
  );

  const press = useCallback(
    (key: string) => {
      if (busy) return;
      setMessage('');
      setDigits((prev) => (prev.length >= PASSCODE_MAX ? prev : prev + key));
    },
    [busy]
  );

  const back = useCallback(() => {
    if (busy) return;
    setMessage('');
    setDigits((prev) => prev.slice(0, -1));
  }, [busy]);

  // 물리 키보드 — 노트북으로 들어온 사람도 그냥 치면 된다
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        back();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        setDigits((current) => {
          void submit(current);
          return current;
        });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [press, back, submit]);

  return (
    <section className="rv-lock" aria-labelledby="rv-lock-title">
      <p className="rv-lock__code" aria-hidden="true">
        {code}
      </p>
      <h1 className="rv-lock__title" id="rv-lock-title">
        {t('resources.lock.title', '잠겨 있습니다')}
      </h1>
      <p className="rv-lock__hint">
        {t('resources.lock.hint', '전달받으신 숫자 비밀번호를 눌러 주세요.')}
      </p>

      <div
        className={`rv-dots${wrong ? ' is-wrong' : ''}`}
        role="status"
        aria-live="polite"
        aria-label={t('resources.lock.entered', '입력한 자리 수') + `: ${digits.length}`}
      >
        {digits.length === 0 ? (
          <span className="rv-dots__empty" aria-hidden="true">
            &nbsp;
          </span>
        ) : (
          Array.from({ length: digits.length }, (_, i) => (
            <span className="rv-dots__dot" key={i} aria-hidden="true" />
          ))
        )}
      </div>

      <p className="rv-lock__message" role="alert">
        {message || ' '}
      </p>

      <div className="rv-keypad">
        {KEYS.map((key) => (
          <button
            type="button"
            className="rv-key"
            key={key}
            onClick={() => press(key)}
            disabled={busy}
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          className="rv-key rv-key--soft"
          onClick={back}
          disabled={busy || !digits}
          aria-label={t('resources.lock.backspace', '한 자 지우기')}
        >
          ⌫
        </button>
        <button type="button" className="rv-key" onClick={() => press('0')} disabled={busy}>
          0
        </button>
        <button
          type="button"
          className="rv-key rv-key--go"
          onClick={() => submit(digits)}
          disabled={busy || digits.length < PASSCODE_MIN}
          aria-label={t('resources.lock.submit', '확인')}
        >
          {busy ? '…' : '→'}
        </button>
      </div>
    </section>
  );
}
