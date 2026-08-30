/**
 * 대리 입력의 맥락 — 어디로 받았고, 누구의 신청인가
 *
 * 답변은 스키마가 정한 문항이고, 여기 있는 것은 **접수 방식에 대한 기록**이다.
 * 섞지 않는다: 문항은 학기마다 바뀌지만 "전화로 받았다"는 사실은 신청서와 무관하게
 * 남아야 하고, 나중에 "이 신청 누가 넣었죠?"를 답하는 것도 이쪽이다.
 *
 * 라벨은 모두 조사 '로'를 받는 형태로 골랐다(전화로·카톡으로가 아니라 문장 안에서
 * 괄호로 붙이므로 실제로는 조사를 쓰지 않지만, 나중에 문장에 넣더라도 깨지지 않게).
 */

import type { FormQuestion, FormSchema } from '@/types/forms';

/**
 * 대리 입력에서 **비어 있어도 통과시키는** 문항.
 *
 * 전화로 받은 신청에는 이메일이 없다. 서버가 봐주는 문항과 화면이 막는 문항이
 * 어긋나면 안내문("이메일을 못 받았으면 비워 두셔도 됩니다")이 거짓말이 된다 —
 * 실제로 그랬다. 그래서 규칙을 여기 한 줄로 두고 양쪽이 같이 본다.
 */
export function isOptionalInStaffEntry(q: FormQuestion): boolean {
  return q.bind === 'email';
}

/**
 * 화면에 줄 스키마 — 위 문항의 `required` 를 내린다.
 *
 * 검증만 느슨하게 하지 않고 스키마째 바꾸는 이유: 라벨의 별표(*)와 검증이
 * 한 곳(문항의 required)에서 나오기 때문이다. 한쪽만 고치면 "필수라고 써 있는데
 * 비워도 넘어가는" 화면이 된다.
 *
 * **저장에는 쓰지 않는다.** 서버는 D1 에 저장된 원본 스키마로 검증하고,
 * 같은 규칙(isOptionalInStaffEntry)으로 이메일만 따로 봐준다.
 */
export function relaxSchemaForStaffEntry(schema: FormSchema): FormSchema {
  return {
    ...schema,
    sections: schema.sections.map((section) => ({
      ...section,
      questions: section.questions.map((q) =>
        q.required && isOptionalInStaffEntry(q) ? { ...q, required: false } : q
      ),
    })),
  };
}

export const ENTRY_CHANNELS = ['phone', 'kakao', 'paper', 'visit', 'email', 'other'] as const;
export type EntryChannel = (typeof ENTRY_CHANNELS)[number];

export const ENTRY_CHANNEL_LABEL: Record<EntryChannel, string> = {
  phone: '전화',
  kakao: '카톡·문자',
  paper: '종이 신청서',
  visit: '방문 접수',
  email: '이메일',
  other: '그 밖의 경로',
};

export function isEntryChannel(value: unknown): value is EntryChannel {
  return typeof value === 'string' && (ENTRY_CHANNELS as readonly string[]).includes(value);
}

/** 메모 상한 — 통화 요지를 적는 칸이지 상담 기록부가 아니다. */
export const ENTRY_MEMO_MAX = 500;

/**
 * 처리 이력에 남길 한 줄. 경로와 메모가 있으면 함께 적는다.
 * "누가 넣었는가"가 먼저다 — 이력에서 눈이 가장 먼저 닿는 자리다.
 */
export function staffEntryNote(input: {
  staffName: string;
  channel?: EntryChannel | null;
  memo?: string | null;
}): string {
  const where = input.channel ? ` (받은 경로: ${ENTRY_CHANNEL_LABEL[input.channel]})` : '';
  const memo = input.memo?.trim();
  return `${input.staffName} 님이 대신 입력했습니다.${where}` + (memo ? `\n${memo}` : '');
}
