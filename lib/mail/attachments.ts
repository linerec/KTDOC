/**
 * 메일 첨부 — "무엇을 붙일 수 있는가"의 단일 규칙 (순수 함수)
 *
 * 첨부는 붙이는 순간이 아니라 **보내는 순간**에 실패한다. 20MB짜리를 붙여
 * 놓고 '보내기'를 누른 뒤에야 "너무 큽니다"를 보면, 선생님은 방금 쓴 글을
 * 다시 쓸지 파일을 줄일지부터 고민하게 된다. 그래서 같은 규칙을 화면(고르는
 * 순간)과 라우트(최종 방어)가 함께 쓴다 — 여기 한 곳에 둔다.
 *
 * 한도의 근거:
 *  - 개당 15MB / 합계 15MB — 우리 쪽 사정이 아니라 **받는 쪽 메일함**이 정한다.
 *    Resend는 한 통에 40MB(base64 후)까지 받지만, 지메일 등은 25MB에서 거른다.
 *    base64는 부피를 3분의 1쯤 불리므로, 원본 15MB가 인코딩 후 20MB로 지메일
 *    한도 안에 들어온다. 우리 화면을 통과한 메일이 받는 이의 서버에서 조용히
 *    반송되는 것이 가장 나쁘다.
 *  - 파일은 브라우저에서 R2로 직접 올라오므로(lib/r2/directUpload.ts) 예전의
 *    진짜 벽이던 Vercel 요청 본문 4.5MB는 더 이상 여기에 없다. 서버는 R2에서
 *    다시 읽어 메일에 실은 뒤 그 임시 파일을 지운다 — 첨부가 공개 주소로
 *    남지 않는다.
 *  - 실행 파일은 아예 막는다. 메일 게이트웨이가 통째로 거부하거나 스팸으로
 *    분류하므로, 붙일 수 있는 척하면 "보냈는데 안 왔다"가 된다.
 *
 * lib/mail/mailer.ts와 달리 provider를 모르고, 브라우저에서도 그대로 쓴다
 * (server-only를 가져오지 않는다 — 화면이 같은 판단을 미리 내려야 한다).
 */

/** provider에 넘기는 첨부 한 건. content는 base64(Resend·nodemailer 공통). */
export interface MailAttachment {
  filename: string;
  contentType: string;
  /** base64 인코딩된 파일 내용 */
  content: string;
  /** 원본 바이트 수 — base64 길이가 아니라 파일 크기(기록·표시용) */
  size: number;
}

/** 발송 내역에 남기는 첨부 흔적. 내용은 보관하지 않고 "무엇을 보냈나"만 남긴다. */
export interface MailAttachmentNote {
  name: string;
  size: number;
}

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_ATTACHMENTS_TOTAL_BYTES = 15 * 1024 * 1024;
/** 안내 문구용 표기 */
export const MAX_ATTACHMENT_MB = 15;
export const MAX_ATTACHMENTS_TOTAL_MB = 15;

/**
 * 메일 게이트웨이가 거부하는 실행 파일 확장자.
 * 압축(zip)은 허용한다 — 실무에서 사진 묶음이 이 형태로 온다.
 */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'cpl', 'scr', 'pif', 'msi', 'msp', 'jar',
  'vb', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'ps1', 'psm1', 'sh',
  'dll', 'sys', 'lnk', 'hta', 'reg', 'apk', 'app', 'deb', 'dmg',
]);

/** 파일명 끝의 확장자(소문자). 없으면 ''. */
export function attachmentExtension(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase();
}

/**
 * 파일명을 안전한 형태로 다듬는다.
 *
 * 경로 조각(`../`, `C:\`)과 제어문자를 떨어뜨린다. 한글은 그대로 둔다 —
 * 메일 헤더 인코딩은 provider가 한다(‘수강료 안내.pdf’가 그대로 보여야 한다).
 */
export function safeAttachmentName(filename: string): string {
  const base = (filename.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f]/g, '');
  const trimmed = base.trim().slice(0, 120);
  return trimmed || '첨부파일';
}

/** 사람이 읽는 크기 표기. 첨부는 KB 단위까지만 봐도 충분하다. */
export function formatAttachmentSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))}KB`;
}

/** 검사에 필요한 것은 이름과 크기뿐 — File도, 서버가 읽은 파일도 같은 모양이 된다. */
export interface AttachmentCandidate {
  name: string;
  size: number;
}

export type AttachmentProblem =
  | { kind: 'too-many'; name?: undefined }
  | { kind: 'blocked-type'; name: string }
  | { kind: 'file-too-large'; name: string }
  | { kind: 'empty-file'; name: string }
  | { kind: 'total-too-large'; name?: undefined };

/** 문제를 사람 말로. 화면과 라우트가 같은 문장을 쓴다. */
export function describeAttachmentProblem(problem: AttachmentProblem): string {
  switch (problem.kind) {
    case 'too-many':
      return `첨부는 ${MAX_ATTACHMENTS}개까지 붙일 수 있습니다.`;
    case 'blocked-type':
      return `‘${problem.name}’ 형식은 메일로 보낼 수 없습니다 — 받는 쪽 메일함이 거부합니다. 압축(zip)해서 붙여 주세요.`;
    case 'file-too-large':
      return `‘${problem.name}’이(가) 너무 큽니다 — 파일 하나는 ${MAX_ATTACHMENT_MB}MB까지입니다.`;
    case 'empty-file':
      return `‘${problem.name}’은(는) 빈 파일입니다.`;
    case 'total-too-large':
      return `첨부 용량 합계가 ${MAX_ATTACHMENTS_TOTAL_MB}MB를 넘습니다 — 받는 쪽 메일함이 거부할 수 있습니다.`;
  }
}

/**
 * 붙일 수 있는가. 문제가 없으면 null.
 *
 * 순서가 곧 안내 순서다 — 개수 → 형식 → 개별 크기 → 합계. 합계를 먼저 말하면
 * "어느 파일이 문제인지"를 스스로 찾아야 한다.
 */
export function checkAttachments(files: AttachmentCandidate[]): AttachmentProblem | null {
  if (files.length > MAX_ATTACHMENTS) return { kind: 'too-many' };

  for (const file of files) {
    const ext = attachmentExtension(file.name);
    if (ext && BLOCKED_EXTENSIONS.has(ext)) {
      return { kind: 'blocked-type', name: safeAttachmentName(file.name) };
    }
    if (file.size <= 0) return { kind: 'empty-file', name: safeAttachmentName(file.name) };
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return { kind: 'file-too-large', name: safeAttachmentName(file.name) };
    }
  }

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_ATTACHMENTS_TOTAL_BYTES) return { kind: 'total-too-large' };

  return null;
}

/** 발송 내역에 남길 값 — 이름·크기만. 파일 내용은 어디에도 보관하지 않는다. */
export function attachmentNotes(attachments: MailAttachment[] | undefined): MailAttachmentNote[] {
  return (attachments ?? []).map((a) => ({ name: a.filename, size: a.size }));
}

/** 한 줄 요약 — 처리 이력·확인 화면에 그대로 붙는다. */
export function describeAttachments(notes: MailAttachmentNote[]): string {
  return notes.map((n) => `${n.name} (${formatAttachmentSize(n.size)})`).join(', ');
}
