/**
 * 신청(수업·캠프 신청) 화면의 라벨
 *
 * 상태 라벨의 한국어 원문은 types/programs.ts의 상수 맵이 갖고 있다 — 여기서는 키코드만 얹는다.
 * 답장 메일 제목도 목록·상세 두 곳에서 같은 규칙으로 만들어야 해서 함께 둔다
 * (한쪽만 바꾸면 신청자에게 서로 다른 제목의 메일이 나간다).
 */

import type { TFunction } from '@/lib/i18n/useT';
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from '@/types/programs';

export function applicationStatusLabel(t: TFunction, status: ApplicationStatus): string {
  return t(`admin.application.status.${status}`, APPLICATION_STATUS_LABELS[status]?.ko ?? status);
}

/** mailto의 subject — "Re: {프로그램} 신청" */
export function replySubject(t: TFunction, programLabel: string): string {
  return encodeURIComponent(
    t('admin.applications.replySubject', 'Re: {program} 신청', { program: programLabel })
  );
}
