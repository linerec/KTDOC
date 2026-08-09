/**
 * 웹 푸시 클라이언트 헬퍼 (브라우저 전용)
 *
 * 권한 요청 → 서비스워커 준비 → PushManager 구독 → 서버 등록까지의 흐름과,
 * 기기/지원 여부 판별을 한곳에 모은다. 클라이언트 컴포넌트에서만 호출한다.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export type Platform = 'ios' | 'android' | 'desktop';

/** VAPID base64url 공개키 → ArrayBuffer (applicationServerKey 용, BufferSource). */
function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

/** 이 브라우저가 웹 푸시를 지원하는가. */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** 홈 화면에 설치된(standalone) 상태로 실행 중인가. iOS 푸시의 전제. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return iosStandalone || displayStandalone;
}

/** 대략적인 플랫폼 판별(안내 문구 분기용). */
export function getPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) {
    return 'ios';
  }
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export function getPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  // 등록은 멱등 — 이미 있으면 기존 등록이 ready된다.
  await navigator.serviceWorker.register('/sw.js').catch(() => {});
  return navigator.serviceWorker.ready;
}

/** 현재 기기의 기존 구독(있으면). 활성 SW가 없어도 멈추지 않도록 ready 대신 getRegistration 사용. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * 이 기기의 기존 구독을 서버에 다시 등록해 "서버도 이 기기를 안다"를 확인한다.
 *
 * 브라우저에 구독이 남아 있다고 알림이 온다는 보장은 없다. 구독은 브라우저에
 * 저장되지만 "누구의 기기인가"는 서버에만 있어서, 같은 브라우저로 다른 계정에
 * 로그인하거나 구독 행이 지워지면 둘이 어긋난다. 등록은 멱등(upsert)이므로
 * 다시 보내는 것으로 확인과 복구를 겸한다 — 마지막 사용 시각도 함께 갱신돼
 * 운영진의 '기기 현황'이 실제에 가까워진다.
 *
 * 권한을 새로 묻지 않는다(이미 있는 구독만 다룬다) — 조용히 실행해도 안전하다.
 */
export async function confirmSubscriptionOnServer(): Promise<boolean> {
  const sub = await getExistingSubscription();
  if (!sub) return false;
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return res.ok;
  } catch {
    // 오프라인·일시 장애 — 확인 실패는 "모른다"로 다룬다(카드를 접지 않는 쪽이 안전).
    return false;
  }
}

export interface SubscribeResult {
  ok: boolean;
  error?: string;
}

/** 권한 요청 → 구독 → 서버 등록. */
export async function subscribePush(): Promise<SubscribeResult> {
  if (!isPushSupported()) {
    return { ok: false, error: '이 브라우저는 알림을 지원하지 않습니다.' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { ok: false, error: '알림 설정(VAPID 키)이 누락되었습니다.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: '알림 권한이 허용되지 않았습니다. 브라우저 설정에서 허용해 주세요.' };
  }

  try {
    const reg = await ensureRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC_KEY),
      });
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || '서버에 구독을 등록하지 못했습니다.' };
    }
    return { ok: true };
  } catch (err) {
    console.error('subscribePush error:', err);
    return { ok: false, error: '구독 중 오류가 발생했습니다.' };
  }
}

/** 현재 기기 구독 해제(브라우저 + 서버). */
export async function unsubscribePush(): Promise<SubscribeResult> {
  try {
    const sub = await getExistingSubscription();
    if (!sub) return { ok: true };
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {});
    return { ok: true };
  } catch (err) {
    console.error('unsubscribePush error:', err);
    return { ok: false, error: '해제 중 오류가 발생했습니다.' };
  }
}

/** 본인에게 테스트 알림 발송. */
export async function sendTestPush(): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await fetch('/api/push/test', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return { ok: false, error: data.error || '테스트 발송에 실패했습니다.' };
  }
  return { ok: true, message: data.message };
}
