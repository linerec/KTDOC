/**
 * 푸시 알림 구독·추적 공용 타입
 *
 * DB 의존성이 없어 클라이언트 컴포넌트에서도 안전하게 import할 수 있다.
 * (조회 함수는 서버 전용 lib/push/* 참고)
 */

import type { MemberRole, MemberStatus } from './members';

/** 구독 생명주기 이벤트 — 켜짐 / 회원이 끔 / 브라우저에서 만료. */
export type PushEventType = 'subscribed' | 'unsubscribed' | 'expired';

export const PUSH_EVENT_LABELS: Record<PushEventType, string> = {
  subscribed: '알림 켬',
  unsubscribed: '알림 끔',
  expired: '만료·삭제됨',
};

/** 회원이 알림을 켜 둔 기기 한 대. */
export interface PushDevice {
  id: number;
  /** 원문 user-agent(라벨 변환은 lib/push/deviceLabel). */
  userAgent: string | null;
  /** 이 기기에서 처음 알림을 켠 시각(ISO). */
  createdAt: string;
  /** 구독을 마지막으로 등록·갱신한 시각(ISO). 도달 시각이 아니다. */
  lastUsedAt: string | null;
  /** 알림이 마지막으로 도달한 시각(ISO). */
  lastSuccessAt: string | null;
  /** 발송이 마지막으로 실패한 시각(ISO). */
  lastFailureAt: string | null;
  successCount: number;
  failCount: number;
}

/** 알림을 켠 회원 한 명과 그 기기들. */
export interface PushMemberStatus {
  userId: string;
  name: string | null;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  devices: PushDevice[];
}

/** 알림을 켜지 않은 정회원. */
export interface PushMemberOff {
  userId: string;
  name: string | null;
  email: string;
  role: MemberRole;
  /** 과거에 켰다가 끈 적이 있으면 그 시각(ISO). 한 번도 켠 적 없으면 null. */
  lastOffAt: string | null;
}

/** 켜기·끄기 이력 한 줄. */
export interface PushEventEntry {
  id: number;
  userId: string;
  name: string | null;
  email: string | null;
  event: PushEventType;
  userAgent: string | null;
  createdAt: string;
}

/** 현황 요약 숫자. */
export interface PushSummary {
  /** 알림을 켠 회원 수(기기 1대 이상). */
  memberCount: number;
  /** 알림이 켜진 기기 총수. */
  deviceCount: number;
  /** 정회원 총수. */
  activeMemberCount: number;
  /** 정회원 중 알림을 켜지 않은 수. */
  offCount: number;
  /** 최근 30일 켜기/끄기/만료 건수. */
  subscribed30d: number;
  unsubscribed30d: number;
  expired30d: number;
}
