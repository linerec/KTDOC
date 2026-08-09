/**
 * 알림 온보딩 카드의 판단 규칙 (순수 함수 — 브라우저 API를 직접 만지지 않는다)
 *
 * 카드가 무엇을 보여줄지, 그리고 아예 접어도 되는지를 결정한다. 이 판단이
 * 조용히 뒤집히면 두 가지 사고가 난다:
 *  - 켜져 있는데 계속 권유 → 매번 닫아야 하는 잔소리
 *  - 안 켜졌는데 접힘      → 알림을 못 받는 줄도 모른다 (더 나쁘다)
 * 그래서 브라우저 API 호출부(client.ts)와 분리해 시험으로 고정한다.
 */

import type { Platform } from './client';

export type OptInState =
  | 'loading'
  | 'unsupported'
  | 'needs-install'
  | 'prompt'
  | 'denied'
  | 'enabled';

/** 카드가 판단에 쓰는 브라우저 사실들. client.ts가 실제 값을 채워 넣는다. */
export interface OptInEnv {
  /** serviceWorker + PushManager + Notification이 모두 있는가. */
  supported: boolean;
  platform: Platform;
  /** 홈 화면에 설치된 상태로 실행 중인가(iOS 푸시의 전제). */
  standalone: boolean;
  permission: NotificationPermission;
  /** 이 브라우저에 PushSubscription이 남아 있는가. */
  hasSubscription: boolean;
}

/**
 * 지금 이 기기에서 무엇을 보여줄지.
 *
 * 순서에 의미가 있다. 미지원이면 권한·구독은 물어볼 수도 없고, iOS는 설치 전에는
 * 항상 미지원으로 보이므로 '설치 안내'를 '미지원'보다 먼저 가려내야 한다.
 */
export function resolveOptInState(env: OptInEnv): OptInState {
  if (!env.supported) {
    // iOS는 홈 화면에 설치해야 PushManager가 노출된다 — 막다른 길이 아니라 한 단계 남은 것.
    return env.platform === 'ios' && !env.standalone ? 'needs-install' : 'unsupported';
  }
  if (env.permission === 'denied') return 'denied';
  return env.hasSubscription ? 'enabled' : 'prompt';
}

/**
 * 카드를 아예 렌더하지 않아도 되는가.
 *
 * `serverKnowsDevice`를 함께 요구하는 게 핵심이다. 브라우저에 구독이 남아 있어도
 * 서버 쪽 등록이 없으면(로그아웃 후 다른 계정으로 로그인, 구독 행 삭제 등) 푸시는
 * 오지 않는다. 그 상태에서 카드를 접으면 회원은 "켜져 있다"고 믿은 채 아무것도
 * 못 받는다 — 확인된 경우에만 접는다.
 */
export function canCollapse(
  state: OptInState,
  hideWhenEnabled: boolean,
  serverKnowsDevice: boolean
): boolean {
  return hideWhenEnabled && state === 'enabled' && serverKnowsDevice;
}
