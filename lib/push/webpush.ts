/**
 * 웹 푸시 발송 — web-push(VAPID) 래퍼 (서버 전용)
 *
 * - VAPID 자격증명을 1회 설정하고, 구독 목록에 알림을 보낸다.
 * - 만료/취소된 구독(404·410)은 발송 시점에 자동 정리(prune)한다.
 * - Node 런타임 필요 — 이 모듈을 쓰는 라우트는 edge 런타임으로 지정하지 않는다.
 */

import webpush from 'web-push';
import type { MemberRole } from '@/types/members';
import {
  type PushSubRow,
  getSubscriptionsForUsers,
  getAllSubscriptions,
  getSubscriptionsByRoles,
  deleteSubscriptionsByIds,
  recordDeliveryResults,
} from './subscriptions';

export interface PushPayload {
  title: string;
  body: string;
  /** 알림 클릭 시 이동할 경로(기본 /admin). */
  url?: string;
  /** 같은 tag면 기기에서 이전 알림을 대체. */
  tag?: string;
}

export interface SendResult {
  sent: number;
  failed: number;
}

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@ktdoc.local';
  if (!publicKey || !privateKey) {
    throw new Error('VAPID 키가 설정되지 않았습니다(VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY).');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/** 구독 목록에 알림 발송 + 만료 구독 정리. */
export async function sendToSubscriptions(
  subs: PushSubRow[],
  payload: PushPayload
): Promise<SendResult> {
  if (!subs.length) return { sent: 0, failed: 0 };
  ensureConfigured();

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/admin',
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;
  const dead: number[] = [];
  const delivered: number[] = [];
  const rejected: number[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data
        );
        sent++;
        delivered.push(s.id);
      } catch (err) {
        failed++;
        rejected.push(s.id);
        const code = (err as { statusCode?: number })?.statusCode;
        // 404(Not Found)·410(Gone): 구독이 더 이상 유효하지 않음 → 정리.
        if (code === 404 || code === 410) dead.push(s.id);
      }
    })
  );

  // 기기별 도달 집계를 먼저 남긴다 — 만료 정리로 행이 사라지기 전에.
  await recordDeliveryResults(delivered, rejected);

  if (dead.length) {
    await deleteSubscriptionsByIds(dead).catch(() => {});
  }
  return { sent, failed };
}

/** 특정 회원들에게 발송. */
export async function sendToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<SendResult> {
  const subs = await getSubscriptionsForUsers(userIds);
  return sendToSubscriptions(subs, payload);
}

/** 전체 구독자에게 발송. */
export async function sendToAll(payload: PushPayload): Promise<SendResult> {
  const subs = await getAllSubscriptions();
  return sendToSubscriptions(subs, payload);
}

/** 특정 역할 회원들에게 발송. */
export async function sendToRoles(
  roles: MemberRole[],
  payload: PushPayload
): Promise<SendResult> {
  const subs = await getSubscriptionsByRoles(roles);
  return sendToSubscriptions(subs, payload);
}
