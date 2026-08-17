'use client';

/**
 * 이메일 수신 스위치 — 내 프로필
 *
 * 푸시 알림 카드 옆에 둔다. "알림을 어떻게 받을지"가 한자리에 모여야
 * 회원이 무엇을 켜고 껐는지 헷갈리지 않는다.
 *
 * 끄더라도 가입 확인·임시 비밀번호는 계속 간다 — 그 사실을 화면에서
 * 미리 말해준다. 껐는데 메일이 오면 고장으로 보이기 때문이다.
 */

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/useT';

export default function EmailOptInCard() {
  const t = useT();
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/account/notifications', {
          cache: 'no-store',
        });
        const json = (await res.json()) as {
          success: boolean;
          emailOptIn?: boolean;
        };
        if (alive && json.success) setOptIn(json.emailOptIn ?? true);
      } catch {
        if (alive) setError(t('mail.optIn.loadFailed', '설정을 불러오지 못했습니다.'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  const toggle = async () => {
    if (optIn === null || saving) return;
    const next = !optIn;
    setSaving(true);
    setError('');
    // 낙관적 반영 — 실패하면 되돌린다
    setOptIn(next);
    try {
      const res = await fetch('/api/account/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOptIn: next }),
      });
      const json = (await res.json()) as { success: boolean };
      if (!res.ok || !json.success) {
        setOptIn(!next);
        setError(t('mail.optIn.saveFailed', '설정을 저장하지 못했습니다.'));
      }
    } catch {
      setOptIn(!next);
      setError(t('mail.optIn.saveFailed', '설정을 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mail-optin-card">
      <div className="mail-optin-head">
        <span className="mail-optin-icon" aria-hidden="true">
          ✉
        </span>
        <div>
          <h2 className="mail-optin-title">
            {t('mail.optIn.title', '이메일로 알림 받기')}
          </h2>
          <p className="mail-optin-lede">
            {t(
              'mail.optIn.lede',
              '수업 등록·공연 안내 같은 소식을 가입하신 이메일로 보내드립니다.'
            )}
          </p>
        </div>
        {optIn !== null && (
          <span
            className={`mail-optin-badge${optIn ? ' is-on' : ''}`}
          >
            {optIn ? t('mail.optIn.on', '켜짐') : t('mail.optIn.off', '꺼짐')}
          </span>
        )}
      </div>

      {optIn === null ? (
        <p className="mail-optin-status">
          {t('mail.optIn.loading', '상태를 확인하는 중…')}
        </p>
      ) : (
        <>
          <label className="mail-optin-switch">
            <input
              type="checkbox"
              checked={optIn}
              disabled={saving}
              onChange={() => void toggle()}
            />
            <span className="mail-switch-track" aria-hidden="true">
              <span className="mail-switch-thumb" />
            </span>
            <span>
              {optIn
                ? t('mail.optIn.labelOn', '이메일 알림을 받고 있습니다')
                : t('mail.optIn.labelOff', '이메일 알림을 받지 않습니다')}
            </span>
          </label>

          <p className="mail-optin-note">
            {t(
              'mail.optIn.note',
              '꺼두셔도 가입 확인과 비밀번호 안내처럼 계정에 꼭 필요한 메일은 계속 보내드립니다.'
            )}
          </p>
        </>
      )}

      {error && <p className="mail-optin-error">{error}</p>}
    </section>
  );
}
