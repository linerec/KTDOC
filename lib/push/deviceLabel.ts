/**
 * 푸시 구독 기기 라벨 — user-agent를 사람이 읽는 한 줄로.
 *
 * 알림 현황 화면에서 "누가 어떤 기기에 켰는지"를 보여줄 때 쓴다. 정밀한 기기
 * 식별이 목적이 아니라 운영진이 "○○ 어머님 아이폰" 정도로 알아보게 하는 것이
 * 목적이므로, 판별은 거칠고 확실한 순서로만 한다.
 *
 * UA는 서로를 흉내 낸다 — 크롬도 "Safari"를, 엣지도 "Chrome"을 달고 다닌다.
 * 그래서 좁은 것부터(엣지 → 삼성 → 오페라 → 크롬 → 파이어폭스 → 사파리) 본다.
 * 순서가 뒤집히면 라벨이 조용히 틀어지므로 deviceLabel.test.ts가 고정한다.
 *
 * 순수 함수 — 서버·클라이언트 어디서나 쓸 수 있다.
 */

export interface DeviceInfo {
  /** 기기·OS 라벨(예: 'iPhone', '윈도우 PC'). */
  device: string;
  /** 브라우저 라벨(예: 'Safari'). 알 수 없으면 빈 문자열. */
  browser: string;
  /** 화면에 그대로 쓰는 한 줄(예: 'iPhone · Safari'). */
  label: string;
}

/** 요약 집계용 기기 종류(라벨과 달리 값이 고정이라 그룹핑에 쓴다). */
export type DeviceKind = 'iphone' | 'ipad' | 'android' | 'mac' | 'windows' | 'other';

const UNKNOWN_DEVICE = '알 수 없는 기기';

function detectDevice(ua: string): string {
  if (/\biPhone\b/i.test(ua)) return 'iPhone';
  if (/\biPad\b/i.test(ua)) return 'iPad';
  if (/\biPod\b/i.test(ua)) return 'iPod';
  if (/\bAndroid\b/i.test(ua)) {
    // 안드로이드는 폰만 "Mobile"을 단다 — 없으면 태블릿.
    return /\bMobile\b/i.test(ua) ? '안드로이드 폰' : '안드로이드 태블릿';
  }
  if (/\bWindows\b/i.test(ua)) return '윈도우 PC';
  if (/\bCrOS\b/i.test(ua)) return '크롬북';
  if (/\bMacintosh\b|\bMac OS X\b/i.test(ua)) return 'Mac';
  if (/\bLinux\b/i.test(ua)) return '리눅스 PC';
  return UNKNOWN_DEVICE;
}

function detectBrowser(ua: string): string {
  if (/\bEdgA?\/|\bEdgiOS\//i.test(ua)) return 'Edge';
  if (/\bSamsungBrowser\//i.test(ua)) return '삼성 인터넷';
  if (/\bOPR\/|\bOpera\b/i.test(ua)) return 'Opera';
  if (/\bWhale\//i.test(ua)) return '웨일';
  if (/\bFxiOS\/|\bFirefox\//i.test(ua)) return 'Firefox';
  if (/\bCriOS\/|\bChrome\//i.test(ua)) return 'Chrome';
  if (/\bSafari\//i.test(ua)) return 'Safari';
  return '';
}

/** user-agent → 화면에 쓸 기기 정보. 빈 값이면 '알 수 없는 기기'. */
export function describeDevice(userAgent: string | null | undefined): DeviceInfo {
  const ua = (userAgent ?? '').trim();
  if (!ua) return { device: UNKNOWN_DEVICE, browser: '', label: UNKNOWN_DEVICE };

  const device = detectDevice(ua);
  const browser = detectBrowser(ua);
  const label = browser ? `${device} · ${browser}` : device;
  return { device, browser, label };
}

/** user-agent → 집계용 기기 종류. */
export function deviceKind(userAgent: string | null | undefined): DeviceKind {
  const ua = (userAgent ?? '').trim();
  if (!ua) return 'other';
  if (/\biPhone\b|\biPod\b/i.test(ua)) return 'iphone';
  if (/\biPad\b/i.test(ua)) return 'ipad';
  if (/\bAndroid\b/i.test(ua)) return 'android';
  if (/\bWindows\b/i.test(ua)) return 'windows';
  if (/\bCrOS\b/i.test(ua)) return 'other';
  if (/\bMacintosh\b|\bMac OS X\b/i.test(ua)) return 'mac';
  return 'other';
}

/** 집계용 종류 → 사람이 읽는 이름(요약 칩에 쓴다). */
export const DEVICE_KIND_LABELS: Record<DeviceKind, string> = {
  iphone: 'iPhone',
  ipad: 'iPad',
  android: '안드로이드',
  mac: 'Mac',
  windows: '윈도우',
  other: '기타',
};
