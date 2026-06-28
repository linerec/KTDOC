'use client';

/**
 * PushOptInCard — 알림 받기 온보딩 카드(원생·학부모 대시보드)
 *
 * 기기/지원 상태에 따라 분기:
 *  - iOS 미설치        → '홈 화면에 추가' 설치 안내
 *  - 미지원 브라우저    → 안내 메시지
 *  - 권한 거부          → 브라우저 설정에서 허용 안내
 *  - 지원/미구독        → "알림 켜기"
 *  - 구독됨            → "테스트 알림 받기" + "알림 끄기"
 */

import { useEffect, useState } from 'react';
import {
  isPushSupported,
  isStandalone,
  getPlatform,
  getPermission,
  getExistingSubscription,
  subscribePush,
  unsubscribePush,
  sendTestPush,
  type Platform,
} from '@/lib/push/client';

type State = 'loading' | 'unsupported' | 'needs-install' | 'prompt' | 'denied' | 'enabled';

export default function PushOptInCard() {
  const [state, setState] = useState<State>('loading');
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;

    // 지원/설치/권한/구독 상태를 클라이언트에서 판별한다(navigator·window 의존).
    const detect = async (): Promise<{ platform: Platform; state: State }> => {
      const platform = getPlatform();
      if (!isPushSupported()) {
        // iOS는 홈 화면에 설치해야 PushManager가 노출된다.
        const state: State = platform === 'ios' && !isStandalone() ? 'needs-install' : 'unsupported';
        return { platform, state };
      }
      if (getPermission() === 'denied') return { platform, state: 'denied' };
      const sub = await getExistingSubscription();
      return { platform, state: sub ? 'enabled' : 'prompt' };
    };

    detect().then(({ platform, state }) => {
      if (cancelled) return;
      setPlatform(platform);
      setState(state);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    const result = await subscribePush();
    setBusy(false);
    if (result.ok) {
      setState('enabled');
      setMsg('알림이 켜졌습니다. 새 소식이 오면 이 기기로 알려드립니다.');
    } else {
      setErr(result.error || '알림을 켜지 못했습니다.');
      if (getPermission() === 'denied') setState('denied');
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    await unsubscribePush();
    setBusy(false);
    setState('prompt');
    setMsg('알림을 껐습니다.');
  };

  const handleTest = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    const result = await sendTestPush();
    setBusy(false);
    if (result.ok) setMsg(result.message || '테스트 알림을 보냈습니다. 잠시 후 도착합니다.');
    else setErr(result.error || '테스트 발송에 실패했습니다.');
  };

  return (
    <section className="push-card">
      <div className="push-card-head">
        <span className="push-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </span>
        <div>
          <h2 className="push-card-title">알림 받기</h2>
          <p className="push-card-lede">
            공연·수업 일정, 준비물, 새 사진 등 중요한 소식을 휴대폰 알림으로 받아보세요.
          </p>
        </div>
        {state === 'enabled' && <span className="push-badge push-badge--on">켜짐</span>}
      </div>

      {state === 'loading' && <p className="push-card-status">상태를 확인하는 중…</p>}

      {state === 'prompt' && (
        <div className="push-card-actions">
          <button className="admin-btn admin-btn-gold" onClick={handleEnable} disabled={busy}>
            {busy ? '설정 중…' : '🔔 알림 켜기'}
          </button>
          <span className="push-card-hint">버튼을 누르면 알림 권한을 한 번 물어봅니다. ‘허용’을 눌러주세요.</span>
        </div>
      )}

      {state === 'enabled' && (
        <div className="push-card-actions">
          <button className="admin-btn admin-btn-primary" onClick={handleTest} disabled={busy}>
            {busy ? '보내는 중…' : '테스트 알림 받기'}
          </button>
          <button className="admin-btn admin-btn-outline" onClick={handleDisable} disabled={busy}>
            알림 끄기
          </button>
        </div>
      )}

      {state === 'needs-install' && (
        <div className="push-card-install">
          <p className="push-card-status">알림을 받으려면 먼저 홈 화면에 앱으로 추가해야 합니다.</p>
          <ol className="push-steps">
            <li>Safari 하단의 <b>공유 버튼</b>(￪)을 누릅니다.</li>
            <li><b>‘홈 화면에 추가’</b>를 선택합니다.</li>
            <li>홈 화면에 생긴 <b>KTDOC</b> 아이콘으로 다시 들어와 ‘알림 켜기’를 누릅니다.</li>
          </ol>
        </div>
      )}

      {state === 'denied' && (
        <div className="push-card-install">
          <p className="push-card-status">알림이 차단되어 있습니다. 브라우저 설정에서 이 사이트의 알림을 ‘허용’으로 바꿔주세요.</p>
          {platform === 'android' && (
            <p className="push-card-hint">Chrome: 주소창 자물쇠(🔒) → 권한 → 알림 → 허용</p>
          )}
          {platform === 'ios' && (
            <p className="push-card-hint">iOS: 설정 → 알림 → KTDOC → 알림 허용</p>
          )}
        </div>
      )}

      {state === 'unsupported' && (
        <p className="push-card-status">
          이 브라우저에서는 알림을 사용할 수 없습니다. 최신 Chrome(안드로이드) 또는 홈 화면에 설치한 iPhone에서 이용해 주세요.
        </p>
      )}

      {msg && <p className="push-card-feedback push-card-feedback--ok" role="status">{msg}</p>}
      {err && <p className="push-card-feedback push-card-feedback--err" role="alert">{err}</p>}
    </section>
  );
}
