'use client';

/**
 * AddToHomeCard — 마이페이지 착지 화면의 '홈 화면에 추가'(A2HS) 유도 카드
 *
 * 목표: 원생·학부모가 콘솔을 홈 화면 아이콘으로 앱처럼 쓰게 유도한다.
 * 특히 아이폰은 홈 화면에 추가해야만 웹 푸시를 받을 수 있어(iOS 16.4+ 제약)
 * 알림 온보딩(PushOptInCard)보다 앞서 보여준다.
 *
 * 플랫폼별 동작:
 *  - iOS Safari: 설치 팝업 API가 없어 공유 → '홈 화면에 추가' 단계 안내만 가능
 *  - iOS 인앱 브라우저(카카오톡 등): 홈 화면 추가가 불가하므로 Safari로 열기 안내
 *  - Android/Chrome 계열: beforeinstallprompt를 잡아 실제 설치 프롬프트 버튼
 *  - 이미 설치(standalone)로 실행 중이거나 '나중에'로 닫았으면 렌더하지 않음
 */

import { useCallback, useSyncExternalStore } from 'react';
import { useT } from '@/lib/i18n/useT';

const DISMISS_KEY = 'a2hs-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ── 모듈 스코프 스토어 — 표시 여부는 브라우저 환경(외부 시스템)이 결정하므로
//    useSyncExternalStore로 구독한다(SSR 스냅샷은 항상 hidden).
//    beforeinstallprompt는 하이드레이션 전에 발화할 수 있어 모듈 로드 시점에 잡아둔다.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
// 저장소 접근 불가 시에도 세션 내 '나중에'가 동작하도록 하는 메모리 폴백
let dismissedMem = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    notify();
  });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function isDismissed(): boolean {
  if (dismissedMem) return true;
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari 전용 속성
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+는 데스크톱 Mac UA를 쓰므로 터치 지점으로 함께 판별
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isInAppBrowser(): boolean {
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|DaumApps/i.test(navigator.userAgent);
}

type Mode = 'hidden' | 'ios-safari' | 'ios-inapp' | 'installable';

function getMode(): Mode {
  if (isDismissed() || installed || isStandalone()) return 'hidden';
  if (isIos()) return isInAppBrowser() ? 'ios-inapp' : 'ios-safari';
  return deferredPrompt ? 'installable' : 'hidden';
}

const ShareIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8.5 6.5 12 3l3.5 3.5" />
    <path d="M6 11H5a1.5 1.5 0 0 0-1.5 1.5V19A1.5 1.5 0 0 0 5 20.5h14A1.5 1.5 0 0 0 20.5 19v-6.5A1.5 1.5 0 0 0 19 11h-1" />
  </svg>
);

const AddIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const PhoneIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
    <path d="M12 8v5M9.5 10.5h5" />
  </svg>
);

export default function AddToHomeCard() {
  const t = useT();
  // SSR·하이드레이션 스냅샷은 hidden — 마운트 후 실제 환경으로 재렌더된다
  const mode = useSyncExternalStore(subscribe, getMode, () => 'hidden' as Mode);

  const handleInstall = useCallback(async () => {
    const evt = deferredPrompt;
    if (!evt) return;
    await evt.prompt();
    // 설치 프롬프트는 이벤트당 1회만 쓸 수 있다 — 결과와 무관하게 소진 처리.
    // 수락 시에는 appinstalled가 별도로 숨김을 확정한다.
    await evt.userChoice.catch(() => null);
    deferredPrompt = null;
    notify();
  }, []);

  const handleDismiss = useCallback(() => {
    dismissedMem = true;
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* 실패해도 메모리 폴백으로 현재 세션에서는 닫힌다 */
    }
    notify();
  }, []);

  if (mode === 'hidden') return null;

  const desc =
    mode === 'ios-inapp'
      ? t('admin.a2hs.desc.inapp', '지금은 앱 안 브라우저라 홈 화면에 추가할 수 없어요. Safari로 열면 추가할 수 있습니다.')
      : mode === 'ios-safari'
        ? t('admin.a2hs.desc.ios', '홈 화면 아이콘으로 한 번에 열 수 있어요. 아이폰은 홈 화면에 추가한 뒤에만 알림을 받을 수 있습니다.')
        : t('admin.a2hs.desc.android', '홈 화면 아이콘으로 한 번에 열고, 알림도 놓치지 않아요.');

  return (
    <section className="a2hs-card" aria-label={t('admin.a2hs.title', '홈 화면에 추가하고 앱처럼 쓰세요')}>
      <div className="a2hs-head">
        <span className="a2hs-icon" aria-hidden="true">{PhoneIcon}</span>
        <div className="a2hs-headtext">
          <h2 className="a2hs-title">{t('admin.a2hs.title', '홈 화면에 추가하고 앱처럼 쓰세요')}</h2>
          <p className="a2hs-desc">{desc}</p>
        </div>
        <button type="button" className="a2hs-later" onClick={handleDismiss}>
          {t('admin.a2hs.later', '나중에')}
        </button>
      </div>

      {mode === 'ios-safari' && (
        <ol className="a2hs-steps">
          <li>
            <span className="a2hs-step-n">1</span>
            {t('admin.a2hs.iosStep1', 'Safari 하단의 공유 버튼을 누르세요')}
            <span className="a2hs-step-icon" aria-hidden="true">{ShareIcon}</span>
          </li>
          <li>
            <span className="a2hs-step-n">2</span>
            {t('admin.a2hs.iosStep2', "'홈 화면에 추가'를 선택하세요")}
            <span className="a2hs-step-icon" aria-hidden="true">{AddIcon}</span>
          </li>
        </ol>
      )}

      {mode === 'ios-inapp' && (
        <ol className="a2hs-steps">
          <li>
            <span className="a2hs-step-n">1</span>
            {t('admin.a2hs.inappStep1', "화면 하단 메뉴에서 '다른 브라우저로 열기(Safari)'를 선택하세요")}
          </li>
          <li>
            <span className="a2hs-step-n">2</span>
            {t('admin.a2hs.inappStep2', "Safari에서 공유 버튼 → '홈 화면에 추가'를 누르세요")}
          </li>
        </ol>
      )}

      {mode === 'installable' && (
        <div className="a2hs-actions">
          <button type="button" className="admin-btn admin-btn-gold" onClick={handleInstall}>
            {t('admin.a2hs.installBtn', '홈 화면에 추가')}
          </button>
        </div>
      )}
    </section>
  );
}
