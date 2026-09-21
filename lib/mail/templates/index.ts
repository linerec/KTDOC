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

// 메일에 쓰는 학원 이름. 제목 접두사와 서명이 모두 여기서 나온다.
// '춤누리'를 뺀 이유: 받는 분들이 부르는 이름이 KTDOC 쪽이고, 제목 앞에
// 붙는 대괄호가 길수록 메일함 목록에서 정작 용건이 잘린다.
const SITE_NAME = 'KTDOC';

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

    // ── 수업 변경 ──
    // data: name · left(빠진 수업, 줄바꿈 구분) · joined(새 수업) · effective(언제부터, 선택)
    //       · stage('planned' 이면 예고, 아니면 적용 안내) · url
    // 학비는 싣지 않는다 — 신청자에게 학비표를 보이지 않는 규칙.
    case 'enrollment.changed:user': {
      const planned = s(data, 'stage') === 'planned';
      const left = s(data, 'left');
      const joined = s(data, 'joined');
      const eff = s(data, 'effective');
      const ko =
        (planned
          ? `${name} 님의 수업이 다음과 같이 변경될 예정입니다.`
          : `${name} 님의 수업이 다음과 같이 변경되었습니다.`) +
        (left ? `\n\n빠지는 수업:\n${left}` : '') +
        (joined ? `\n\n새 수업:\n${joined}` : '') +
        (eff ? `\n\n적용 시점: ${eff}` : '') +
        `\n\n달라진 점이 있거나 뜻하신 바와 다르면 학원으로 알려 주세요.${linkKo}`;
      const en =
        (planned
          ? `The following change is planned for ${name}'s classes.`
          : `${name}'s classes have been changed as follows.`) +
        (left ? `\n\nLeaving:\n${left}` : '') +
        (joined ? `\n\nJoining:\n${joined}` : '') +
        (eff ? `\n\nEffective: ${eff}` : '') +
        `\n\nIf this is not what you intended, please let us know.${linkEn}`;
      return {
        subject: planned
          ? `수업 변경 예정 안내 — ${name} / Planned class change`
          : `수업 변경 안내 — ${name} / Class change`,
        text: bilingual(ko, en),
      };
    }

    case 'enrollment.changed:staff': {
      const planned = s(data, 'stage') === 'planned';
      const left = s(data, 'left');
      const joined = s(data, 'joined');
      const eff = s(data, 'effective');
      return {
        subject: `[${SITE_NAME}] 수업 변경${planned ? ' 예고' : ''} — ${name}`,
        text: bilingual(
          `${planned ? '수업 변경이 예고되었습니다' : '수업이 변경되었습니다'}.\n\n원생: ${name}\n처리: ${s(data, 'by', '운영진')}` +
            (left ? `\n빠지는 수업: ${left.replace(/\n/g, ', ')}` : '') +
            (joined ? `\n새 수업: ${joined.replace(/\n/g, ', ')}` : '') +
            (eff ? `\n적용 시점: ${eff}` : '') +
            linkKo,
          `${planned ? 'A class change was announced' : 'Classes were changed'}.\n\nStudent: ${name}\nBy: ${s(data, 'by', 'staff')}` +
            (left ? `\nLeaving: ${left.replace(/\n/g, ', ')}` : '') +
            (joined ? `\nJoining: ${joined.replace(/\n/g, ', ')}` : '') +
            (eff ? `\nEffective: ${eff}` : '') +
            linkEn
        ),
      };
    }

    // ── 신청 내용 변경(배정 전) ──
    // data: name · title(신청서) · change("A → B") · url
    case 'form.corrected:user':
      return {
        subject: `신청 내용이 변경되었습니다 — ${title} / Application updated`,
        text: bilingual(
          `${name} 님의 신청 내용이 변경되었습니다.\n\n신청서: ${title}\n신청 과목: ${s(data, 'change')}\n\n뜻하신 바와 다르면 학원으로 알려 주세요.${linkKo}`,
          `${name}'s application has been updated.\n\nForm: ${title}\nClasses: ${s(data, 'change')}\n\nIf this is not what you intended, please let us know.${linkEn}`
        ),
      };

    case 'form.corrected:staff':
      return {
        subject: `[${SITE_NAME}] 신청 내용 변경 — ${title} / ${name}`,
        text: bilingual(
          `신청 내용이 변경되었습니다.\n\n신청서: ${title}\n학생: ${name}\n처리: ${s(data, 'by', '운영진')}\n신청 과목: ${s(data, 'change')}${linkKo}`,
          `An application was updated.\n\nForm: ${title}\nStudent: ${name}\nBy: ${s(data, 'by', 'staff')}\nClasses: ${s(data, 'change')}${linkEn}`
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

    // data.resubmit: 이전 신청을 대체했을 때 "바뀐 것" 한 줄("A → B"). 없으면 첫 제출.
    // 재제출임을 접수 메일이 말하지 않으면, 학원은 새 학생인 줄 알고 학부모는
    // 옛 신청이 살아 있는 줄 안다.
    case 'form.submitted:user': {
      const re = s(data, 'resubmit');
      return {
        subject: re ? `신청서를 다시 접수했습니다 — ${title}` : `신청서가 접수되었습니다 — ${title}`,
        text: bilingual(
          `${name} 님, 신청서가 접수되었습니다.\n\n신청서: ${title}` +
            (re ? `\n\n이전에 내신 신청을 이번 것으로 대체했습니다.\n신청 과목: ${re}` : '') +
            `\n\n확인 후 안내드리겠습니다.${linkKo}`,
          `Hello ${name}, your form was submitted.\n\nForm: ${title}` +
            (re ? `\n\nThis replaces your earlier submission.\nClasses: ${re}` : '') +
            `\n\nWe'll be in touch after review.${linkEn}`
        ),
      };
    }

    case 'form.submitted:staff': {
      const re = s(data, 'resubmit');
      const prev = s(data, 'previous');
      return {
        subject: re
          ? `[${SITE_NAME}] 신청서 재제출 — ${title} / ${name}`
          : `[${SITE_NAME}] 신청서 응답 — ${title} / ${name}`,
        text: bilingual(
          `${re ? '신청서가 다시 제출되었습니다' : '신청서 응답이 들어왔습니다'}.\n\n신청서: ${title}\n제출자: ${name}` +
            (re ? `\n이전 응답: ${prev}\n신청 과목: ${re}\n\n배정이 끝난 신청이면 새 응답에서 '수업에 넣기'를 눌러 명단을 맞춰 주세요.` : '') +
            linkKo,
          `${re ? 'A form was resubmitted' : 'A new form response'}.\n\nForm: ${title}\nSubmitted by: ${name}` +
            (re ? `\nPrevious: ${prev}\nClasses: ${re}` : '') +
            linkEn
        ),
      };
    }

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

    // 영문 본문도 준비물(noteEn)을 싣는다. 예전에는 한국어 쪽에만 있었다 —
    // 무엇을 챙겨 와야 하는지가 이 메일의 용건인데, 영어로 읽는 가족에게는
    // 일시·장소만 가고 그 문장이 통째로 빠졌다. noteEn이 비면(영문 준비물을
    // 아직 안 적은 공연) 한국어 원문을 그대로 실어 둔다 — 없는 것보다는 낫고,
    // 관리 화면의 '영문으로 번역'이 그 칸을 채우는 길이다.
    case 'event.reminder:user':
      return {
        subject: `내일 일정 안내 — ${title}`,
        text: bilingual(
          `내일 일정을 안내드립니다.\n\n${title}${s(data, 'when') ? `\n일시: ${s(data, 'when')}` : ''}${s(data, 'where') ? `\n장소: ${s(data, 'where')}` : ''}${s(data, 'note') ? `\n\n${s(data, 'note')}` : ''}${linkKo}`,
          `A reminder for tomorrow.\n\n${title}${s(data, 'whenEn', s(data, 'when')) ? `\nWhen: ${s(data, 'whenEn', s(data, 'when'))}` : ''}${s(data, 'where') ? `\nWhere: ${s(data, 'where')}` : ''}${s(data, 'noteEn', s(data, 'note')) ? `\n\n${s(data, 'noteEn', s(data, 'note'))}` : ''}${linkEn}`
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

    // 인쇄물 도안 확인 페이지의 회신. 사람이 고르고 쓴 답이 그대로 실린다 —
    // notice.broadcast와 같은 이유로 답 자체는 번역하지 않는다.
    case 'print.feedback:staff':
      return {
        subject: `[${SITE_NAME}] 도안 회신 — ${title || '인쇄물'}`,
        text: bilingual(
          `도안 확인 페이지에서 회신이 왔습니다.\n\n${'─'.repeat(24)}\n\n${s(data, 'message')}${linkKo}`,
          `A reply came in from the print proof page. The message above is as written.${linkEn}`
        ),
      };

    // 자료함 받기 링크. 파일은 붙이지 않는다 — 링크는 용량 제한이 없고,
    // 나간 뒤에도 관리 화면에서 무효화할 수 있다.
    case 'resource.link:user':
      return {
        subject: `[${SITE_NAME}] 공연 자료 — ${title}`,
        text: bilingual(
          `요청하신 공연 자료입니다.\n\n${title}\n\n아래 주소를 열면 비밀번호 없이 바로 재생하거나 저장하실 수 있습니다.\n${s(data, 'link')}\n\n이 링크는 24시간 뒤 만료됩니다. 자료의 저작권은 학원과 원저작자에게 있으니 공연 목적 외로 쓰거나 다시 공유하지 말아 주세요.`,
          `Here are the show files you requested.\n\n${title}\n\nOpen the link below to play or save them — no passcode needed.\n${s(data, 'link')}\n\nThe link expires in 24 hours. These files are copyrighted; please use them for this performance only and do not share them further.`
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
