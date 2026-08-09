/**
 * 체크인 버튼 문구 — 학생 본인(CheckinButton)과 학부모 대행(ParentCheckin)이 함께 쓴다
 *
 * 네 갈래를 판단한다: 처리 중인가 / 이미 응답했나 / 다가오는 공연인가.
 * 지난 공연에 "참여 신청"이 뜨거나 다가오는 공연에 "참여함"이 뜨면 곧바로 오해가 되므로
 * 두 화면이 같은 규칙을 쓰도록 한곳에 둔다.
 */

import type { TFunction } from '@/lib/i18n/useT';

interface CheckinLabelArgs {
  busy: boolean;
  checked: boolean;
  upcoming: boolean;
  /** 취소 문구를 짧게 쓸지(학부모 행처럼 폭이 좁은 자리) */
  shortCancel?: boolean;
}

export function checkinLabel(
  t: TFunction,
  { busy, checked, upcoming, shortCancel = false }: CheckinLabelArgs
): string {
  if (busy) return t('admin.checkin.busy', '처리 중…');
  if (checked) {
    if (upcoming) return t('admin.checkin.cancelUpcoming', '✓ 참여 예정 · 취소');
    return shortCancel
      ? t('admin.checkin.cancelPastShort', '✓ 참여함 · 취소')
      : t('admin.checkin.cancelPast', '✓ 참여함 · 체크인 취소');
  }
  return upcoming ? t('admin.checkin.join', '참여 신청') : t('admin.checkin.checkIn', '참여 체크인');
}
