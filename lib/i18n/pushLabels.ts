/**
 * 알림(푸시) 화면의 라벨 — 기기 이름, 변경 이벤트
 *
 * 기기 판별은 lib/push/deviceLabel이 '키'로 내주고(iPhone·안드로이드 폰·…),
 * 여기서 그 키에 화면 문구를 붙인다. 한국어 원문은 lib의 라벨 맵이 폴백이라
 * 판별에 종류가 추가돼도 화면이 키코드로 깨지지 않는다.
 */

import type { TFunction } from '@/lib/i18n/useT';
import {
  BROWSER_LABELS,
  DEVICE_KIND_LABELS,
  DEVICE_LABELS,
  describeDeviceKeys,
  type DeviceKind,
} from '@/lib/push/deviceLabel';
import { PUSH_EVENT_LABELS, type PushEventType } from '@/types/push';

/** "iPhone · Safari" — 기기와 브라우저를 언어에 맞춰 한 줄로 */
export function deviceLabel(t: TFunction, userAgent: string | null | undefined): string {
  const { deviceKey, browserKey } = describeDeviceKeys(userAgent);
  const device = t(`admin.device.${deviceKey}`, DEVICE_LABELS[deviceKey]);
  if (!browserKey) return device;
  const browser = t(`admin.browser.${browserKey}`, BROWSER_LABELS[browserKey]);
  return `${device} · ${browser}`;
}

/** 요약 칩의 기기 종류(iPhone 3 · 안드로이드 1 …) */
export function deviceKindLabel(t: TFunction, kind: DeviceKind): string {
  return t(`admin.deviceKind.${kind}`, DEVICE_KIND_LABELS[kind] ?? kind);
}

/** 변경 이력의 사건(켬·끔·만료) */
export function pushEventLabel(t: TFunction, event: PushEventType): string {
  return t(`admin.pushEvent.${event}`, PUSH_EVENT_LABELS[event] ?? event);
}
