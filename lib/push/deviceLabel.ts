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

/**
 * 판별 결과는 '키'다 — 화면 문구는 아래 라벨 맵(한국어)이나 번역(admin.device.*)이 붙인다.
 * 그래야 같은 판별을 두 언어가 나눠 쓸 수 있다.
 */
export type DeviceKey =
  | 'iphone' | 'ipad' | 'ipod' | 'androidPhone' | 'androidTablet'
  | 'windows' | 'chromebook' | 'mac' | 'linux' | 'unknown';

export type BrowserKey =
  | 'edge' | 'samsung' | 'opera' | 'whale' | 'firefox' | 'chrome' | 'safari';

export const DEVICE_LABELS: Record<DeviceKey, string> = {
  iphone: 'iPhone',
  ipad: 'iPad',
  ipod: 'iPod',
  androidPhone: '안드로이드 폰',
  androidTablet: '안드로이드 태블릿',
  windows: '윈도우 PC',
  chromebook: '크롬북',
  mac: 'Mac',
  linux: '리눅스 PC',
  unknown: '알 수 없는 기기',
};

export const BROWSER_LABELS: Record<BrowserKey, string> = {
  edge: 'Edge',
  samsung: '삼성 인터넷',
  opera: 'Opera',
  whale: '웨일',
  firefox: 'Firefox',
  chrome: 'Chrome',
  safari: 'Safari',
};

function detectDevice(ua: string): DeviceKey {
  if (/\biPhone\b/i.test(ua)) return 'iphone';
  if (/\biPad\b/i.test(ua)) return 'ipad';
  if (/\biPod\b/i.test(ua)) return 'ipod';
  if (/\bAndroid\b/i.test(ua)) {
    // 안드로이드는 폰만 "Mobile"을 단다 — 없으면 태블릿.
    return /\bMobile\b/i.test(ua) ? 'androidPhone' : 'androidTablet';
  }
  if (/\bWindows\b/i.test(ua)) return 'windows';
  if (/\bCrOS\b/i.test(ua)) return 'chromebook';
  if (/\bMacintosh\b|\bMac OS X\b/i.test(ua)) return 'mac';
  if (/\bLinux\b/i.test(ua)) return 'linux';
  return 'unknown';
}

function detectBrowser(ua: string): BrowserKey | null {
  if (/\bEdgA?\/|\bEdgiOS\//i.test(ua)) return 'edge';
  if (/\bSamsungBrowser\//i.test(ua)) return 'samsung';
  if (/\bOPR\/|\bOpera\b/i.test(ua)) return 'opera';
  if (/\bWhale\//i.test(ua)) return 'whale';
  if (/\bFxiOS\/|\bFirefox\//i.test(ua)) return 'firefox';
  if (/\bCriOS\/|\bChrome\//i.test(ua)) return 'chrome';
  if (/\bSafari\//i.test(ua)) return 'safari';
  return null;
}

/** user-agent → 판별 키만. 화면 문구를 언어에 맞춰 붙이려는 쪽이 쓴다. */
export function describeDeviceKeys(userAgent: string | null | undefined): {
  deviceKey: DeviceKey;
  browserKey: BrowserKey | null;
} {
  const ua = (userAgent ?? '').trim();
  if (!ua) return { deviceKey: 'unknown', browserKey: null };
  return { deviceKey: detectDevice(ua), browserKey: detectBrowser(ua) };
}

/** user-agent → 화면에 쓸 기기 정보(한국어). 빈 값이면 '알 수 없는 기기'. */
export function describeDevice(userAgent: string | null | undefined): DeviceInfo {
  const { deviceKey, browserKey } = describeDeviceKeys(userAgent);
  const device = DEVICE_LABELS[deviceKey];
  const browser = browserKey ? BROWSER_LABELS[browserKey] : '';
  return { device, browser, label: browser ? `${device} · ${browser}` : device };
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
