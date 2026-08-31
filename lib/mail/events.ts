/**
 * 메일 이벤트 레지스트리 — 이벤트 "존재"의 진실의 원천(SSOT)
 *
 * 새 알림 추가 = 이 배열에 1건 + templates/index.ts에 본문 1개.
 * 관리 화면(/admin/mail)은 이 배열을 순회해 그리므로 화면 코드를 건드리지 않는다.
 *
 * DB 의존성이 없어 서버/클라이언트 어디서나 import 가능하다
 * (lib/admin/menu-registry.ts·lib/ai/registry.ts와 같은 관용구).
 */

import type { MailAudience } from '@/types/mail';

export type MailEventGroup = 'member' | 'lesson' | 'show' | 'ops';

export interface MailEventDef {
  key: string;
  /** 관리 화면에 표시할 이름 */
  label: string;
  /** 무슨 일이 생겼을 때 나가는지 — 화면 설명문 */
  description: string;
  group: MailEventGroup;
  /** 이 사건에서 알릴 수 있는 대상 */
  audiences: readonly MailAudience[];
  /** 끌 수 없는 대상 — 화면에 스위치 대신 '필수' 배지가 뜬다 */
  essential?: readonly MailAudience[];
  /** 설정에 값이 없을 때의 기본값 */
  defaultOn: Partial<Record<MailAudience, boolean>>;
  /**
   * true면 발송 내역에 본문을 저장하지 않는다.
   * 임시 비밀번호처럼 본문에 평문 비밀이 실리는 이벤트용.
   */
  redactBody?: boolean;
  /**
   * 한 번에 여러 명에게 BCC로 나가는 이벤트.
   * 한도를 통째로 판정하고(모자라면 전원 보류) 로그를 batch_id로 묶는다.
   */
  bulk?: boolean;
  /**
   * 수신자가 회원이 아닐 수 있는 이벤트(문의 접수 등).
   * 개인 수신거부 관문을 건너뛴다 — 끌 대상 계정이 없다.
   */
  allowNonMember?: boolean;
}

export const MAIL_EVENT_GROUPS: { key: MailEventGroup; label: string }[] = [
  { key: 'member', label: '회원' },
  { key: 'lesson', label: '수업' },
  { key: 'show', label: '공연' },
  { key: 'ops', label: '운영' },
];

export const MAIL_EVENTS: readonly MailEventDef[] = [
  {
    key: 'member.signup',
    label: '회원가입',
    description: '새 회원이 가입 신청을 마쳤을 때.',
    group: 'member',
    audiences: ['user', 'staff'],
    essential: ['user'],
    defaultOn: { user: true, staff: true },
  },
  {
    key: 'member.approved',
    label: '가입 승인',
    description: '운영진이 가입을 승인해 정회원이 되었을 때.',
    group: 'member',
    audiences: ['user'],
    defaultOn: { user: true },
  },
  {
    key: 'member.temp_password',
    label: '임시 비밀번호 발급',
    description:
      '운영진이 임시 비밀번호를 발급했을 때. 본문에 비밀번호가 실리므로 발송 내역에는 본문을 남기지 않습니다.',
    group: 'member',
    audiences: ['user'],
    essential: ['user'],
    defaultOn: { user: true },
    redactBody: true,
  },
  {
    key: 'enrollment.created',
    label: '수업 등록',
    description: '원생이 수업·프로그램에 배정되었을 때.',
    group: 'lesson',
    audiences: ['user', 'staff'],
    defaultOn: { user: true, staff: true },
  },
  {
    key: 'application.created',
    label: '공연 참가 신청',
    description: '공연 참가 신청서가 접수되었을 때.',
    group: 'show',
    audiences: ['user', 'staff'],
    defaultOn: { user: true, staff: true },
    allowNonMember: true,
  },
  {
    key: 'checkin.created',
    label: '공연 참여 확정',
    description:
      '공연 참여가 확정(체크인)되었을 때. 빈도가 높아 기본은 꺼둡니다.',
    group: 'show',
    audiences: ['user', 'staff'],
    defaultOn: { user: false, staff: false },
  },
  {
    key: 'form.submitted',
    label: '신청서 제출',
    description: '신청서(질문지) 응답이 접수되었을 때.',
    group: 'show',
    audiences: ['user', 'staff'],
    defaultOn: { user: true, staff: true },
    allowNonMember: true,
  },
  // 공개 문의 폼이 아직 사이트에 없어 '문의 접수' 이벤트는 두지 않는다.
  // (/api/feedback은 관리자 전용 요구사항 폼이라 성격이 다르다)
  // 문의 폼이 생기면 여기 한 줄 + 본문 하나면 관리 화면에 저절로 나타난다.
  {
    key: 'event.reminder',
    label: '공연 전날 안내',
    description:
      '공연 하루 전, 참여가 확정된 원생과 보호자에게. 한 번에 여러 명에게 나가므로 하루 한도를 가장 많이 씁니다.',
    group: 'show',
    audiences: ['user'],
    defaultOn: { user: true },
    bulk: true,
  },
  {
    key: 'notice.broadcast',
    label: '운영진이 보내는 공지',
    description:
      '알림 보내기 화면에서 운영진이 직접 쓴 공지. 휴대폰 알림과 함께 이메일로도 갈 때 이 스위치를 따릅니다.',
    group: 'ops',
    audiences: ['user'],
    // 공지는 필수가 아니다 — 수신거부하신 분께는 보내지 않는다.
    // (가입 확인·비밀번호처럼 계정에 꼭 필요한 메일만 essential 이다.)
    defaultOn: { user: true },
  },
  {
    key: 'form.message',
    label: '신청 건 개별 메시지',
    description:
      '신청 상세 화면에서 운영진이 신청하신 분께 직접 쓴 메일. 쓰신 내용이 그대로 나갑니다. 이 스위치를 끄면 그 화면의 발송이 통째로 막힙니다.',
    group: 'ops',
    audiences: ['user'],
    // 개별 메시지도 수신거부는 존중한다 — 다만 화면이 "이 분은 꺼두셨습니다"를
    // 미리 말해 주므로, 선생님은 전화 같은 다른 길을 그 자리에서 고를 수 있다.
    defaultOn: { user: true },
  },
  {
    key: 'quota.warning',
    label: '발송 한도 경고',
    description:
      '하루 발송량이 설정한 비율을 넘었을 때 운영진에게. 하루 한 번만 나갑니다.',
    group: 'ops',
    audiences: ['staff'],
    essential: ['staff'],
    defaultOn: { staff: true },
  },
  {
    key: 'print.feedback',
    label: '인쇄물 도안 회신',
    description:
      '도안 확인 페이지에서 회신이 왔을 때. 아래 운영진 주소가 아니라 도안을 고치는 담당자에게 갑니다(환경변수 PRINT_FEEDBACK_TO). 회신은 따로 저장되지 않고 이 메일 한 통이 전부이므로 끌 수 없습니다.',
    group: 'ops',
    audiences: ['staff'],
    // 이 회신은 어디에도 저장되지 않는다. 스위치를 끄면 회신이 통째로 사라지고
    // 보내신 분은 전달된 줄 안다 — 그래서 끌 수 없다.
    essential: ['staff'],
    defaultOn: { staff: true },
  },
] as const;

const BY_KEY = new Map(MAIL_EVENTS.map((e) => [e.key, e]));

/** 키로 이벤트 정의를 찾는다. 모르는 키는 null(호출부가 로그만 남기고 넘어간다). */
export function getMailEvent(key: string): MailEventDef | null {
  return BY_KEY.get(key) ?? null;
}

/** 이 대상은 끌 수 없는가 */
export function isEssential(def: MailEventDef, audience: MailAudience): boolean {
  return def.essential?.includes(audience) ?? false;
}
