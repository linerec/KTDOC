/**
 * 도안 회신이 도착할 주소 — 이 사건만의 수신처
 *
 * 다른 운영 알림은 관리 콘솔의 '운영진 주소'(mail.config.staffTo)로 간다.
 * 도안 회신은 그럴 수 없다 — 거기 적힌 값은 학원 대표 메일(원장님)이고,
 * 단장님이 답을 보내면 학원 메일함에만 쌓인 채 도안을 고칠 사람에게는
 * 오지 않는다. 답을 받아야 할 사람은 그 답으로 일할 사람이다.
 *
 * **이 모듈은 서버에서만 쓴다.** 화면(ConfirmForm)이 import하는 bannerConfirm.ts와
 * 나눠 둔 이유다 — 합치면 담당자 주소가 브라우저로 내려가 수집 대상이 된다.
 */

// 상대 import에 확장자를 붙인다 — 이 모듈은 node --test로 직접 실행되고,
// Node ESM은 확장자를 요구한다(lib/mail/recipients.ts와 같은 이유).
import { isValidEmail } from '../mail/config.ts';

/** 환경변수(PRINT_FEEDBACK_TO)가 없을 때 회신이 갈 곳 */
export const DEFAULT_PRINT_FEEDBACK_TO = 'owenkdev@gmail.com';

/**
 * 쉼표로 나눈 주소 목록을 다듬는다.
 *
 * 성한 주소가 하나도 없으면 기본 주소로 떨어진다 — 환경변수 오타 하나로
 * 회신이 아무 데도 가지 않는 편보다, 원래 자리로 가는 편이 낫다.
 */
export function resolvePrintFeedbackTo(raw: string | undefined): string[] {
  const listed = (raw ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter((address) => isValidEmail(address));

  const unique = Array.from(new Set(listed));
  return unique.length > 0 ? unique : [DEFAULT_PRINT_FEEDBACK_TO];
}
