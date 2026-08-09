/**
 * 회원 역할·상태 라벨의 번역 이름
 *
 * 라벨의 한국어 원문은 types/members.ts의 상수 맵이 갖고 있다(서버·클라이언트 공용).
 * 여기서는 그 값을 폴백으로 두고 키코드를 얹기만 한다 — 상수 맵에 역할이 추가되면
 * 폴백은 자동으로 따라오고, 번역만 두 locale 파일에 추가하면 된다.
 */

import type { TFunction } from '@/lib/i18n/useT';
import {
  MEMBER_ROLE_LABELS,
  MEMBER_STATUS_LABELS,
  type MemberRole,
  type MemberStatus,
} from '@/types/members';

export function roleLabel(t: TFunction, role: MemberRole): string {
  return t(`admin.member.role.${role}`, MEMBER_ROLE_LABELS[role] ?? role);
}

export function statusLabel(t: TFunction, status: MemberStatus): string {
  return t(`admin.member.status.${status}`, MEMBER_STATUS_LABELS[status] ?? status);
}
