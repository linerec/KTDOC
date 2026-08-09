'use client';

/**
 * PushOptInCard — 알림 받기 카드
 *
 * 두 자리에서 서로 다르게 쓴다(placement):
 *  - 'dashboard' — 아직 안 켠 사람에게 권한다. 켜고 나면 사라진다.
 *  - 'settings'  — 내 프로필에 늘 남아 끄기·테스트의 집이 된다.
 * 대시보드에서 사라진 뒤에도 끌 수 있어야 하므로 두 자리는 한 쌍이다. 한쪽만 두면
 * "켤 수는 있는데 끌 수는 없는" 카드가 된다.
 *
 * audience는 받는 소식의 성격이다(원생·학부모 / 운영진). 설명 문구와 가이드의
 * 예시 목록이 여기서 갈린다.
 *
 * 기기/지원 상태 분기는 lib/push/optIn.ts(순수 함수)가 정하고 여기서는 그리기만 한다.
 */

import { useEffect, useState } from 'react';
import {
  isPushSupported,
  isStandalone,
  getPlatform,
  getPermission,
  getExistingSubscription,
  confirmSubscriptionOnServer,
  subscribePush,
  unsubscribePush,
  sendTestPush,
  type Platform,
} from '@/lib/push/client';
import { resolveOptInState, canCollapse, type OptInState } from '@/lib/push/optIn';
import { useT } from '@/lib/i18n/useT';
import PushGuideModal, { type GuideAudience } from './PushGuideModal';

interface Props {
  /** 어디에 놓였는가 — 권유 자리(대시보드)인지 설정 자리(내 프로필)인지. */
  placement?: 'dashboard' | 'settings';
  /** 누가 받는 알림인가 — 설명 문구와 가이드 예시가 갈린다. */
  audience?: GuideAudience;
}

export default function PushOptInCard({
  placement = 'dashboard',
  audience = 'member',
}: Props) {
  const t = useT();
  const [state, setState] = useState<OptInState>('loading');
  const [platform, setPlatform] = useState<Platform>('desktop');
  // 서버도 이 기기를 알고 있다고 확인됐는가. 접기 판단의 두 번째 조건.
  const [serverKnowsDevice, setServerKnowsDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;

    // 브라우저 사실을 모아 순수 함수에 넘긴다(navigator·window 의존은 여기까지).
    const detect = async () => {
      const platform = getPlatform();
      const supported = isPushSupported();
      const hasSubscription = supported ? (await getExistingSubscription()) !== null : false;
      const state = resolveOptInState({
        supported,
        platform,
        standalone: isStandalone(),
        permission: getPermission(),
        hasSubscription,
      });
      // 켜져 있을 때만 서버에 확인한다 — 안 켠 기기에는 확인할 것이 없다.
      const serverKnowsDevice = state === 'enabled' ? await confirmSubscriptionOnServer() : false;
      return { platform, state, serverKnowsDevice };
    };

    detect().then((next) => {
      if (cancelled) return;
      setPlatform(next.platform);
      setState(next.state);
      setServerKnowsDevice(next.serverKnowsDevice);
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
      // 방금 서버에 등록하고 온 길이다.
      setServerKnowsDevice(true);
      setMsg(t('push.card.onOk', '알림이 켜졌습니다. 새 소식이 오면 이 기기로 알려드립니다.'));
    } else {
      setErr(result.error || t('push.card.onFail', '알림을 켜지 못했습니다.'));
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
    setServerKnowsDevice(false);
    setMsg(t('push.card.offOk', '알림을 껐습니다.'));
  };

  const handleTest = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    const result = await sendTestPush();
    setBusy(false);
    if (result.ok) {
      setMsg(result.message || t('push.card.testSent', '테스트 알림을 보냈습니다. 잠시 후 도착합니다.'));
    } else {
      setErr(result.error || t('push.card.testFail', '테스트 발송에 실패했습니다.'));
    }
  };

  // 방금 켠 직후에는 접지 않는다 — 안내 문구(msg)를 읽을 새도 없이 사라지면
  // 눌렀는데 아무 일도 안 일어난 것처럼 보인다.
  if (canCollapse(state, placement === 'dashboard', serverKnowsDevice) && !msg) return null;

  const lede =
    placement === 'settings'
      ? t(
          'push.card.ledeSettings',
          '이 기기에서 알림을 받을지 설정합니다. 휴대폰과 컴퓨터는 따로 켜야 합니다.'
        )
      : audience === 'staff'
        ? t(
            'push.card.ledeStaff',
            '새 가입 신청 등 확인이 필요한 일을 휴대폰 알림으로 받아보세요. 기기마다 한 번씩 켜야 합니다.'
          )
        : t(
            'push.card.ledeMember',
            '공연·수업 일정, 준비물, 새 사진 등 중요한 소식을 휴대폰 알림으로 받아보세요.'
          );

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
          <h2 className="push-card-title">{t('push.card.title', '알림 받기')}</h2>
          <p className="push-card-lede">{lede}</p>
          {/* 어려워하는 분을 위한 자세한 안내 — 그림과 함께 단계별로. */}
          <PushGuideModal audience={audience} />
        </div>
        {state === 'enabled' && (
          <span className="push-badge push-badge--on">{t('push.card.on', '켜짐')}</span>
        )}
      </div>

      {state === 'loading' && (
        <p className="push-card-status">{t('push.card.checking', '상태를 확인하는 중…')}</p>
      )}

      {state === 'prompt' && (
        <div className="push-card-actions">
          <button className="admin-btn admin-btn-gold" onClick={handleEnable} disabled={busy}>
            {busy ? t('push.card.turningOn', '설정 중…') : `🔔 ${t('push.card.turnOn', '알림 켜기')}`}
          </button>
          <span className="push-card-hint">
            {t('push.card.promptHint', '버튼을 누르면 알림 권한을 한 번 물어봅니다. ‘허용’을 눌러주세요.')}
          </span>
        </div>
      )}

      {state === 'enabled' && (
        <div className="push-card-actions">
          <button className="admin-btn admin-btn-primary" onClick={handleTest} disabled={busy}>
            {busy ? t('push.card.sending', '보내는 중…') : t('push.card.test', '테스트 알림 받기')}
          </button>
          <button className="admin-btn admin-btn-outline" onClick={handleDisable} disabled={busy}>
            {t('push.card.turnOff', '알림 끄기')}
          </button>
          {/* 브라우저에는 구독이 있는데 서버 등록이 확인되지 않은 상태.
              둘이 어긋나면 알림이 오지 않으므로 조용히 넘기지 않는다. */}
          {!serverKnowsDevice && (
            <span className="push-card-hint">
              {t(
                'push.card.unconfirmed',
                '이 기기의 알림 등록을 확인하지 못했습니다. 알림이 오지 않으면 ‘알림 끄기’ 후 다시 켜주세요.'
              )}
            </span>
          )}
        </div>
      )}

      {state === 'needs-install' && (
        <div className="push-card-install">
          <p className="push-card-status">
            {t('push.card.installLede', '알림을 받으려면 먼저 홈 화면에 앱으로 추가해야 합니다.')}
          </p>
          <ol className="push-steps">
            <li>{t('push.card.install1', 'Safari 하단의 공유 버튼(￪)을 누릅니다.')}</li>
            <li>{t('push.card.install2', '‘홈 화면에 추가’를 선택합니다.')}</li>
            <li>
              {t(
                'push.card.install3',
                '홈 화면에 생긴 KTDOC 아이콘으로 다시 들어와 ‘알림 켜기’를 누릅니다.'
              )}
            </li>
          </ol>
        </div>
      )}

      {state === 'denied' && (
        <div className="push-card-install">
          <p className="push-card-status">
            {t(
              'push.card.deniedLede',
              '알림이 차단되어 있습니다. 브라우저 설정에서 이 사이트의 알림을 ‘허용’으로 바꿔주세요.'
            )}
          </p>
          {platform === 'android' && (
            <p className="push-card-hint">
              {t('push.card.deniedAndroid', 'Chrome: 주소창 자물쇠(🔒) → 권한 → 알림 → 허용')}
            </p>
          )}
          {platform === 'ios' && (
            <p className="push-card-hint">
              {t('push.card.deniedIos', 'iOS: 설정 → 알림 → KTDOC → 알림 허용')}
            </p>
          )}
        </div>
      )}

      {state === 'unsupported' && (
        <p className="push-card-status">
          {t(
            'push.card.unsupported',
            '이 브라우저에서는 알림을 사용할 수 없습니다. 최신 Chrome(안드로이드) 또는 홈 화면에 설치한 iPhone에서 이용해 주세요.'
          )}
        </p>
      )}

      {msg && <p className="push-card-feedback push-card-feedback--ok" role="status">{msg}</p>}
      {err && <p className="push-card-feedback push-card-feedback--err" role="alert">{err}</p>}
    </section>
  );
}
