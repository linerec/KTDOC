/**
 * 발송 한도 판정 (순수 함수)
 *
 * Resend 무료는 월 3,000 / 하루 100이고 하루 100은 하드 캡이다(초과분 과금이
 * 아니라 그냥 막힌다). 그리고 To·CC·BCC의 각 수신자를 1통으로 세므로,
 * 판정 단위도 "수신자 수"다.
 *
 * 한도를 넘기 전에 막는 것이 핵심 — 429를 받고 실패하는 것보다
 * "한도 초과로 미발송 12건"이 화면에 남는 편이 낫다.
 */

import type { MailQuotaConfig, MailUsage } from '@/types/mail';

export type QuotaDecision =
  | { allow: true; warn: boolean }
  | { allow: false; reason: 'daily' | 'monthly'; warn: boolean };

export function quotaPercent(sent: number, limit: number): number {
  if (!limit || limit <= 0) return 100;
  return Math.min(100, Math.round((sent / limit) * 100));
}

/**
 * 이 발송을 허용할지 정한다.
 *
 * @param recipientCount 이번에 보낼 수신자 수(단체 발송은 전원)
 * @param essential      끌 수 없는 메일인가 — 한도를 넘어도 보낸다
 */
export function decideQuota(
  usage: MailUsage,
  limits: MailQuotaConfig,
  recipientCount: number,
  essential: boolean
): QuotaDecision {
  const afterDaily = usage.dailySent + recipientCount;
  const afterMonthly = usage.monthlySent + recipientCount;
  const warn =
    quotaPercent(afterDaily, limits.dailyLimit) >= limits.warnAtPercent;

  // 못 보내면 계정을 못 쓰는 메일은 한도보다 우선한다.
  if (essential) return { allow: true, warn };

  // 단체 발송에서 일부만 보내면 "누구는 받고 누구는 못 받은" 상태가 된다 —
  // 그건 안 보낸 것보다 나쁘다(아무도 그 사실을 모른다). 통째로 판정한다.
  if (afterDaily > limits.dailyLimit) {
    return { allow: false, reason: 'daily', warn };
  }
  if (afterMonthly > limits.monthlyLimit) {
    return { allow: false, reason: 'monthly', warn };
  }
  return { allow: true, warn };
}
