/**
 * 지난 공연 체크인 버튼 문구 — EventResponseButtons의 한 칸 토글이 쓴다
 *
 * 다가오는 공연은 [참여][불참] 두 칸이라 이 문구를 쓰지 않는다. 지난 공연의 체크인은
 * 응답이 아니라 "참여했다"는 기록이므로 '참여 체크인 ↔ 참여함 · 취소'로 말한다.
 */

import type { TFunction } from '@/lib/i18n/useT';

interface CheckinLabelArgs {
  busy: boolean;
  checked: boolean;
  /** 취소 문구를 짧게 쓸지(학부모 행처럼 폭이 좁은 자리) */
  shortCancel?: boolean;
}

export function checkinLabel(
  t: TFunction,
  { busy, checked, shortCancel = false }: CheckinLabelArgs
): string {
  if (busy) return t('admin.checkin.busy', '처리 중…');
  if (checked) {
    return shortCancel
      ? t('admin.checkin.cancelPastShort', '✓ 참여함 · 취소')
      : t('admin.checkin.cancelPast', '✓ 참여함 · 체크인 취소');
  }
  return t('admin.checkin.checkIn', '참여 체크인');
}
