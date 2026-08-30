/**
 * 메일 본문 — 이벤트별 제목·내용
 *
 * 회원별 언어 선호를 저장하는 자리가 없으므로(users에 언어 컬럼이 없다)
 * 한 통에 한국어와 영어를 함께 싣는다. 제목도 '한국어 / English'.
 * 한인 무용단이라 두 언어 독자가 실제로 섞여 있고, 수신자마다 어느 쪽인지
 * 알 방법이 없다 — 둘 다 넣는 편이 한쪽을 찍는 것보다 낫다.
 *
 * 새 이벤트 추가 = 여기 case 1개 + events.ts에 정의 1건.
 */

import type { MailAudience } from '@/types/mail';

/** 템플릿이 쓰는 치환값. 호출부가 채운다. */
export type MailTemplateData = Record<string, string | number | undefined | null>;

export interface MailBody {
  subject: string;
  text: string;
}

const SITE_NAME = 'KTDOC 춤누리';

/** 한국어 본문과 영어 본문을 구분선으로 잇는다. */
function bilingual(ko: string, en: string): string {
  return `${ko.trim()}\n\n${'─'.repeat(32)}\n\n${en.trim()}\n\n— ${SITE_NAME}`;
}

function s(data: MailTemplateData, key: string, fallback = ''): string {
  const v = data[key];
  return v === undefined || v === null || v === '' ? fallback : String(v);
}

/**
 * 이벤트 키와 대상에 맞는 제목·본문을 만든다.
 * 모르는 키는 일반 문구로 떨어진다 — 레지스트리에만 추가하고 본문을 빠뜨려도
 * 발송이 통째로 깨지지 않는다.
 */
export function renderMailBody(
  eventKey: string,
  audience: MailAudience,
  data: MailTemplateData
): MailBody {
  const name = s(data, 'name', '회원');
  const title = s(data, 'title');
  const url = s(data, 'url');
  const linkKo = url ? `\n\n자세히 보기: ${url}` : '';
  const linkEn = url ? `\n\nDetails: ${url}` : '';

  switch (`${eventKey}:${audience}`) {
    // 운영진이 직접 쓴 공지 — 본문이 사람 손으로 들어온다.
    // 다른 이벤트와 달리 **번역문을 붙이지 않는다.** 쓰신 말 그대로 나가야 한다
    // (영문을 지어내면 원장님이 쓰지 않은 문장이 학원 이름으로 나간다).
    case 'notice.broadcast:user':
      return {
        subject: title || `[${SITE_NAME}] 안내`,
        text: `${s(data, 'message')}${linkKo}\n\n— ${SITE_NAME}`,
      };

    // 신청 상세에서 선생님이 직접 쓴 1:1 메일. notice.broadcast와 같은 이유로
    // **번역문을 붙이지 않는다** — 영문을 지어내면 쓰지 않은 문장이 학원 이름으로
    // 나간다. 인사말도 붙이지 않는다(선생님이 이미 쓰신 인사와 겹친다).
    case 'form.message:user':
      return {
        subject: title || `[${SITE_NAME}] 안내`,
        text: `${s(data, 'message')}${linkKo}\n\n— ${SITE_NAME}`,
      };

    case 'member.signup:user':
      return {
        subject: '가입 신청이 접수되었습니다 / Registration received',
        text: bilingual(
          `${name} 님, 가입 신청이 접수되었습니다.\n\n운영진이 확인한 뒤 승인해 드립니다. 승인이 끝나면 다시 안내드리겠습니다.${linkKo}`,
          `Hello ${name}, we received your registration.\n\nOur staff will review and approve it shortly. We'll email you again once it's approved.${linkEn}`
        ),
      };

    case 'member.signup:staff':
      return {
        subject: `[${SITE_NAME}] 새 가입 신청 — ${name}`,
        text: bilingual(
          `새 회원이 가입을 신청했습니다.\n\n이름: ${name}\n이메일: ${s(data, 'email', '-')}\n연락처: ${s(data, 'phone', '-')}${linkKo}`,
          `A new member has registered.\n\nName: ${name}\nEmail: ${s(data, 'email', '-')}\nPhone: ${s(data, 'phone', '-')}${linkEn}`
        ),
      };

    case 'member.approved:user':
      return {
        subject: '가입이 승인되었습니다 / Your account is approved',
        text: bilingual(
          `${name} 님, 가입이 승인되었습니다.\n\n이제 로그인하여 수업 일정과 공연 소식을 확인하실 수 있습니다.${linkKo}`,
          `Hello ${name}, your account has been approved.\n\nYou can now sign in to view class schedules and performance news.${linkEn}`
        ),
      };

    case 'member.temp_password:user':
      return {
        subject: '임시 비밀번호 안내 / Temporary password',
        text: bilingual(
          `${name} 님, 임시 비밀번호를 발급해 드렸습니다.\n\n임시 비밀번호: ${s(data, 'tempPassword')}\n\n이 비밀번호로 로그인하시면 새 비밀번호를 정하는 화면으로 이동합니다. 보안을 위해 로그인 후 바로 변경해 주세요.${linkKo}`,
          `Hello ${name}, a temporary password has been issued for your account.\n\nTemporary password: ${s(data, 'tempPassword')}\n\nAfter signing in you'll be asked to set a new password. Please change it right away.${linkEn}`
        ),
      };

    case 'enrollment.created:user':
      return {
        subject: `수업 등록 안내 — ${title} / Class enrollment`,
        text: bilingual(
          `${name} 님의 수업 등록이 완료되었습니다.\n\n수업: ${title}${s(data, 'schedule') ? `\n일정: ${s(data, 'schedule')}` : ''}${linkKo}`,
          `Enrollment confirmed for ${name}.\n\nClass: ${title}${s(data, 'schedule') ? `\nSchedule: ${s(data, 'schedule')}` : ''}${linkEn}`
        ),
      };

    case 'enrollment.created:staff':
      return {
        subject: `[${SITE_NAME}] 수업 등록 — ${name} / ${title}`,
        text: bilingual(
          `수업 등록이 있었습니다.\n\n원생: ${name}\n수업: ${title}${linkKo}`,
          `A new class enrollment.\n\nStudent: ${name}\nClass: ${title}${linkEn}`
        ),
      };

    case 'application.created:user':
      return {
        subject: `참가 신청이 접수되었습니다 — ${title}`,
        text: bilingual(
          `${name} 님, 참가 신청이 접수되었습니다.\n\n공연: ${title}\n\n확인 후 안내드리겠습니다.${linkKo}`,
          `Hello ${name}, your application was received.\n\nPerformance: ${title}\n\nWe'll be in touch after review.${linkEn}`
        ),
      };

    case 'application.created:staff':
      return {
        subject: `[${SITE_NAME}] 참가 신청 — ${title} / ${name}`,
        text: bilingual(
          `참가 신청이 접수되었습니다.\n\n공연: ${title}\n신청자: ${name}\n이메일: ${s(data, 'email', '-')}\n연락처: ${s(data, 'phone', '-')}${linkKo}`,
          `A new application was received.\n\nPerformance: ${title}\nApplicant: ${name}\nEmail: ${s(data, 'email', '-')}\nPhone: ${s(data, 'phone', '-')}${linkEn}`
        ),
      };

    case 'checkin.created:user':
      return {
        subject: `참여가 확정되었습니다 — ${title}`,
        text: bilingual(
          `${name} 님의 참여가 확정되었습니다.\n\n공연: ${title}${s(data, 'when') ? `\n일시: ${s(data, 'when')}` : ''}${s(data, 'where') ? `\n장소: ${s(data, 'where')}` : ''}${linkKo}`,
          `Participation confirmed for ${name}.\n\nPerformance: ${title}${s(data, 'when') ? `\nWhen: ${s(data, 'when')}` : ''}${s(data, 'where') ? `\nWhere: ${s(data, 'where')}` : ''}${linkEn}`
        ),
      };

    case 'checkin.created:staff':
      return {
        subject: `[${SITE_NAME}] 참여 확정 — ${title} / ${name}`,
        text: bilingual(
          `참여가 확정되었습니다.\n\n공연: ${title}\n참가자: ${name}${linkKo}`,
          `Participation confirmed.\n\nPerformance: ${title}\nParticipant: ${name}${linkEn}`
        ),
      };

    case 'form.submitted:user':
      return {
        subject: `신청서가 접수되었습니다 — ${title}`,
        text: bilingual(
          `${name} 님, 신청서가 접수되었습니다.\n\n신청서: ${title}\n\n확인 후 안내드리겠습니다.${linkKo}`,
          `Hello ${name}, your form was submitted.\n\nForm: ${title}\n\nWe'll be in touch after review.${linkEn}`
        ),
      };

    case 'form.submitted:staff':
      return {
        subject: `[${SITE_NAME}] 신청서 응답 — ${title} / ${name}`,
        text: bilingual(
          `신청서 응답이 들어왔습니다.\n\n신청서: ${title}\n제출자: ${name}${linkKo}`,
          `A new form response.\n\nForm: ${title}\nSubmitted by: ${name}${linkEn}`
        ),
      };

    case 'feedback.created:user':
      return {
        subject: '문의가 접수되었습니다 / We received your message',
        text: bilingual(
          `${name} 님, 문의가 접수되었습니다.\n\n보내주신 내용을 확인한 뒤 답변드리겠습니다.\n\n─ 보내신 내용 ─\n${s(data, 'message')}`,
          `Hello ${name}, we received your message.\n\nWe'll review it and get back to you.\n\n— Your message —\n${s(data, 'message')}`
        ),
      };

    case 'feedback.created:staff':
      return {
        subject: `[${SITE_NAME}] 홈페이지 문의 — ${name}`,
        text: bilingual(
          `홈페이지 문의가 접수되었습니다.\n\n이름: ${name}\n이메일: ${s(data, 'email', '-')}\n연락처: ${s(data, 'phone', '-')}\n\n─ 내용 ─\n${s(data, 'message')}`,
          `A new inquiry from the website.\n\nName: ${name}\nEmail: ${s(data, 'email', '-')}\nPhone: ${s(data, 'phone', '-')}\n\n— Message —\n${s(data, 'message')}`
        ),
      };

    case 'event.reminder:user':
      return {
        subject: `내일 일정 안내 — ${title}`,
        text: bilingual(
          `내일 일정을 안내드립니다.\n\n${title}${s(data, 'when') ? `\n일시: ${s(data, 'when')}` : ''}${s(data, 'where') ? `\n장소: ${s(data, 'where')}` : ''}${s(data, 'note') ? `\n\n${s(data, 'note')}` : ''}${linkKo}`,
          `A reminder for tomorrow.\n\n${title}${s(data, 'when') ? `\nWhen: ${s(data, 'when')}` : ''}${s(data, 'where') ? `\nWhere: ${s(data, 'where')}` : ''}${linkEn}`
        ),
      };

    case 'quota.warning:staff':
      return {
        subject: `[${SITE_NAME}] 오늘 메일 발송량이 ${s(data, 'percent')}%에 도달했습니다`,
        text: bilingual(
          `오늘 메일 발송량이 한도에 가까워졌습니다.\n\n오늘: ${s(data, 'dailySent')} / ${s(data, 'dailyLimit')} 통\n이번 달: ${s(data, 'monthlySent')} / ${s(data, 'monthlyLimit')} 통\n\n한도에 도달하면 일반 알림은 발송되지 않고 내역에 '한도 초과'로 기록됩니다. 비밀번호 안내처럼 꼭 필요한 메일은 계속 나갑니다.${linkKo}`,
          `Today's email volume is approaching the limit.\n\nToday: ${s(data, 'dailySent')} / ${s(data, 'dailyLimit')}\nThis month: ${s(data, 'monthlySent')} / ${s(data, 'monthlyLimit')}\n\nOnce the limit is reached, non-essential notifications are held and recorded as "quota exceeded". Essential emails still go out.${linkEn}`
        ),
      };

    default:
      // 레지스트리에만 있고 본문이 없는 이벤트 — 발송이 깨지지 않게 일반 문구로.
      return {
        subject: `[${SITE_NAME}] ${title || '알림'}`,
        text: bilingual(
          `${SITE_NAME}에서 보내는 알림입니다.${title ? `\n\n${title}` : ''}${linkKo}`,
          `A notification from ${SITE_NAME}.${title ? `\n\n${title}` : ''}${linkEn}`
        ),
      };
  }
}
