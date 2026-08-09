/**
 * 프로그램 종류·수강 상태 라벨의 번역 이름
 *
 * 한국어 원문은 types/programs.ts의 상수 맵이 갖고 있다(공개 페이지가 .ko/.en을 직접 쓴다).
 * 관리 콘솔에서는 그 값을 폴백으로 두고 키코드를 얹는다 — 운영진이 D1 오버라이드로
 * 문구를 고칠 수 있고, 상수에 종류가 추가되면 폴백은 자동으로 따라온다.
 */

import type { TFunction } from '@/lib/i18n/useT';
import {
  PROGRAM_TYPE_LABELS,
  ENROLLMENT_STATUS_LABELS,
  type ProgramType,
  type EnrollmentStatus,
} from '@/types/programs';

export function programTypeLabel(t: TFunction, type: ProgramType): string {
  return t(`admin.program.type.${type}`, PROGRAM_TYPE_LABELS[type]?.ko ?? type);
}

export function enrollmentStatusLabel(t: TFunction, status: EnrollmentStatus): string {
  return t(`admin.program.enrollment.${status}`, ENROLLMENT_STATUS_LABELS[status]?.ko ?? status);
}
