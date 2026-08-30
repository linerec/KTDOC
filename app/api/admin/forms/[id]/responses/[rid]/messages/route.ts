/**
 * 신청 건 개별 메시지 — GET(준비 상태·수신자·보낸 내역) / POST(발송)
 *
 * 이 화면의 메일은 다른 알림과 성격이 다르다. **사람이 그 자리에서 쓰고, 그
 * 자리에서 결과를 확인한다.** 그래서 두 가지를 반드시 지킨다:
 *
 *  1. 보내기 전에 "어디로 가는지"를 화면이 먼저 말한다(GET).
 *  2. 보낸 뒤에 "정말 나갔는지"를 화면이 그대로 말한다(POST). 실패했는데
 *     "보냈습니다"를 띄우면 선생님은 오지 않을 답장을 기다린다.
 *
 * 주소는 클라이언트가 정하지 않는다. 후보 목록을 서버가 만들고, 클라이언트는
 * 그 중 어느 것을 골랐는지(키)만 돌려보낸다 — 화면에 보이지 않던 주소로는
 * 절대 나가지 않는다.
 *
 * 첨부 파일은 **이 라우트를 지나오지 않는다.** 브라우저가 R2로 곧장 올리고
 * (Vercel 함수의 4.5MB 본문 한도를 피한다) 여기에는 티켓만 온다. 서버는 그
 * 파일을 R2에서 다시 읽어 메일에 싣고, **보낸 뒤 지운다** — 첨부가 공개 주소에
 * 남으면 안 되기 때문이다(수강료 안내서·인보이스가 그런 파일이다).
 *
 * 작은 파일을 multipart로 그대로 보내는 옛 경로도 아직 받는다(4.5MB 이하).
 * 붙일 수 있는지는 화면이 미리 판정하지만 여기서 한 번 더 판정한다 — 화면을
 * 거치지 않은 요청도 같은 규칙을 받아야 한다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import {
  addResponseNote,
  getMailLogForAddresses,
  getResponseById,
} from '@/lib/d1';
import { getMemberById, getOptedOutEmails } from '@/lib/members';
import {
  buildMessageRecipients,
  defaultRecipientKeys,
  resolvePickedAddresses,
  type MessageRecipient,
} from '@/lib/forms/responseMessage';
import {
  checkAttachments,
  describeAttachmentProblem,
  describeAttachments,
  safeAttachmentName,
  MAX_ATTACHMENTS,
  type MailAttachment,
  type MailAttachmentNote,
} from '@/lib/mail/attachments';
import { deleteFromR2 } from '@/lib/r2';
import { finalizeTicket, readR2Object } from '@/lib/r2/directUpload';
import { uploadTargetByKey } from '@/lib/r2/uploadTargets';
import { getMailEvent, MAIL_EVENTS } from '@/lib/mail/events';
import { isAudienceOn } from '@/lib/mail/recipients';
import { loadMailConfig } from '@/lib/mail/store';
import { resolveMailConfig } from '@/lib/mail/mailer';
import { notifyEvent } from '@/lib/mail/notify';
import type { FormResponseRow } from '@/types/forms';
import type { MailConfig } from '@/types/mail';

const EVENT_KEY = 'form.message';

/** 제목·본문 상한. 메일 한 통 분량을 넘어서면 그건 다른 도구가 할 일이다. */
const MAX_SUBJECT = 200;
const MAX_BODY = 4000;

interface RouteParams {
  params: Promise<{ id: string; rid: string }>;
}

/** 이 신청과 이어진 주소 후보를 서버에서 만든다(GET·POST가 같은 답을 내야 한다). */
async function recipientsFor(
  response: FormResponseRow
): Promise<MessageRecipient[]> {
  const member = response.student_user_id
    ? await getMemberById(response.student_user_id).catch(() => null)
    : null;

  const guardians = (member?.guardians ?? []).map((g) => ({
    name: g.guardianName,
    email: g.guardianEmail,
  }));

  const all = [response.email, member?.email, ...guardians.map((g) => g.email)]
    .filter((e): e is string => Boolean(e));
  const optedOut = await getOptedOutEmails(all).catch(() => new Set<string>());

  return buildMessageRecipients({
    responseEmail: response.email,
    studentName: response.student_name,
    member: member ? { name: member.name, email: member.email } : null,
    guardians,
    optedOutEmails: Array.from(optedOut),
  });
}

/** 지금 이 화면에서 메일을 보낼 수 있는 상태인가 — 못 보내면 이유까지. */
function sendability(config: MailConfig, recipients: MessageRecipient[]) {
  const resolved = resolveMailConfig(config);
  const def = getMailEvent(EVENT_KEY);
  const switchOn = def ? isAudienceOn(def, 'user', config.events) : false;
  const openAddresses = recipients.filter((r) => !r.blocked).length;

  const reason =
    resolved.provider === 'none'
      ? ('no-provider' as const)
      : !switchOn
        ? ('switch-off' as const)
        : openAddresses === 0
          ? ('no-recipients' as const)
          : null;

  return {
    ready: reason === null,
    reason,
    // 답장이 어디로 도착하는지 — 보내는 사람이 알아야 할 사실이다.
    replyTo:
      resolved.provider === 'none'
        ? config.replyTo
        : resolved.replyTo || resolved.from,
    fromName: resolved.provider === 'none' ? config.fromName : resolved.fromName,
    from: resolved.provider === 'none' ? config.from : resolved.from,
  };
}

const EVENT_LABEL = new Map(MAIL_EVENTS.map((e) => [e.key, e.label]));

/** 저장된 첨부 흔적 JSON을 화면이 쓰는 모양으로. 깨진 값은 조용히 비운다. */
function parseAttachmentNotes(raw: string | null): MailAttachmentNote[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is MailAttachmentNote =>
        Boolean(x) && typeof (x as MailAttachmentNote).name === 'string'
      )
      .map((x) => ({ name: x.name, size: Number(x.size) || 0 }));
  } catch {
    return [];
  }
}

async function historyFor(recipients: MessageRecipient[]) {
  const rows = await getMailLogForAddresses(
    recipients.map((r) => r.email),
    20
  ).catch(() => []);
  return rows.map((row) => ({
    id: row.id,
    eventKey: row.event_key,
    eventLabel: EVENT_LABEL.get(row.event_key) ?? row.event_key,
    /** 사람이 직접 쓴 메일인가 — 자동 안내와 눈으로 구분되어야 한다 */
    handwritten: row.event_key === EVENT_KEY,
    to: row.to_address,
    subject: row.subject,
    body: row.body,
    /** 본문이 없는 이유: 보안상 저장하지 않은 것인가 */
    bodyRedacted: getMailEvent(row.event_key)?.redactBody === true,
    status: row.status,
    detail: row.detail,
    attachments: parseAttachmentNotes(row.attachments),
    createdAt: row.created_at,
  }));
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { rid } = await params;
    const responseId = Number(rid);
    if (!Number.isInteger(responseId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const response = await getResponseById(responseId);
    if (!response) {
      return NextResponse.json({ success: false, error: '응답을 찾을 수 없습니다.' }, { status: 404 });
    }

    const [recipients, config] = await Promise.all([
      recipientsFor(response),
      loadMailConfig(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        recipients,
        defaultKeys: defaultRecipientKeys(recipients),
        sending: sendability(config, recipients),
        history: await historyFor(recipients),
      },
    });
  } catch (error) {
    console.error('신청 메시지 조회 오류:', error);
    return NextResponse.json({ success: false, error: '불러오지 못했습니다.' }, { status: 500 });
  }
}

interface SendPayload {
  subject: string;
  body: string;
  /** 서버가 만든 후보 중 고른 것들의 키 */
  keys: string[];
  attachments: MailAttachment[];
}

/** 보내고 나면 지울 임시 첨부 파일들(R2). 공개 주소에 남기지 않는다. */
interface SendPayloadWithCleanup extends SendPayload {
  tempKeys: string[];
}

/**
 * 보낼 내용을 읽는다.
 *
 *  - 새 경로: JSON + 티켓. 파일은 이미 R2에 있고, 여기서 읽어 base64로 옮긴다.
 *  - 옛 경로: multipart로 파일이 그대로 온다(4.5MB 이하에서만 성립).
 *
 * 어느 쪽이든 이 아래(notify → mailer)에는 base64만 내려간다 — 발송 코드는
 * File도 R2도 몰라야 한다.
 */
async function readSendPayload(
  request: Request,
  userId: string
): Promise<SendPayloadWithCleanup | { error: string }> {
  const contentType = request.headers.get('content-type') ?? '';

  if (!contentType.includes('multipart/form-data')) {
    const payload = (await request.json().catch(() => null)) as {
      subject?: unknown;
      body?: unknown;
      to?: unknown;
      uploads?: unknown;
    } | null;

    const base = {
      subject: typeof payload?.subject === 'string' ? payload.subject.trim() : '',
      body: typeof payload?.body === 'string' ? payload.body.trim() : '',
      keys: Array.isArray(payload?.to)
        ? payload.to.filter((k): k is string => typeof k === 'string')
        : [],
    };

    const raw = Array.isArray(payload?.uploads) ? payload.uploads : [];
    if (!raw.length) return { ...base, attachments: [], tempKeys: [] };
    if (raw.length > MAX_ATTACHMENTS) {
      return { error: describeAttachmentProblem({ kind: 'too-many' }) };
    }

    const target = uploadTargetByKey('mail-attachment', 'mail-attachments');
    if (!target) return { error: '첨부를 처리하지 못했습니다.' };

    const attachments: MailAttachment[] = [];
    const tempKeys: string[] = [];

    for (const item of raw) {
      const entry = (item ?? {}) as Record<string, unknown>;
      const ticket = typeof entry.ticket === 'string' ? entry.ticket : '';
      const name = typeof entry.name === 'string' ? entry.name : '';
      if (!ticket) return { error: '첨부 정보를 확인하지 못했습니다. 다시 붙여 주세요.' };

      const finalized = await finalizeTicket(ticket, target, userId, name);
      if (!finalized.ok) {
        await discardTempFiles(tempKeys);
        return { error: finalized.error };
      }
      tempKeys.push(finalized.upload.key);

      // 메일에 실으려면 바이트가 필요하다. 함수가 R2에서 당겨오는 데는
      // 4.5MB 한도가 없다(그 한도는 함수로 들어오고 나가는 본문에만 걸린다).
      const buffer = await readR2Object(finalized.upload.key);
      if (!buffer) {
        await discardTempFiles(tempKeys);
        return { error: '첨부 파일을 읽지 못했습니다. 다시 시도해 주세요.' };
      }

      attachments.push({
        filename: safeAttachmentName(name || finalized.upload.originalName),
        contentType: finalized.upload.contentType,
        content: buffer.toString('base64'),
        size: buffer.byteLength,
      });
    }

    const problem = checkAttachments(attachments.map((a) => ({ name: a.filename, size: a.size })));
    if (problem) {
      await discardTempFiles(tempKeys);
      return { error: describeAttachmentProblem(problem) };
    }

    return { ...base, attachments, tempKeys };
  }

  const form = await request.formData().catch(() => null);
  if (!form) return { error: '보낼 내용을 읽지 못했습니다. 다시 시도해 주세요.' };

  const subject = String(form.get('subject') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();
  const keys = form
    .getAll('to')
    .map((v) => String(v))
    .filter(Boolean);

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length > MAX_ATTACHMENTS) {
    return { error: describeAttachmentProblem({ kind: 'too-many' }) };
  }

  // 화면이 이미 판정했지만 한 번 더 — 화면을 거치지 않은 요청도 같은 규칙을 받는다.
  const problem = checkAttachments(files.map((f) => ({ name: f.name, size: f.size })));
  if (problem) return { error: describeAttachmentProblem(problem) };

  const attachments: MailAttachment[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    attachments.push({
      filename: safeAttachmentName(file.name),
      contentType: file.type || 'application/octet-stream',
      content: buffer.toString('base64'),
      size: buffer.byteLength,
    });
  }

  return { subject, body, keys, attachments, tempKeys: [] };
}

/** 메일에 실은 뒤 남은 임시 파일을 지운다 — 실패해도 발송 흐름을 깨지 않는다. */
async function discardTempFiles(keys: string[]): Promise<void> {
  for (const key of keys) {
    await deleteFromR2(key).catch((error) => {
      console.warn('[mail] 첨부 임시 파일 정리 실패:', key, error);
    });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { rid } = await params;
    const responseId = Number(rid);
    if (!Number.isInteger(responseId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const response = await getResponseById(responseId);
    if (!response) {
      return NextResponse.json({ success: false, error: '응답을 찾을 수 없습니다.' }, { status: 404 });
    }

    const parsed = await readSendPayload(request, session?.user?.id ?? '');
    if ('error' in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const { subject, body, keys, attachments, tempKeys } = parsed;

    if (!subject || !body) {
      return NextResponse.json(
        { success: false, error: '제목과 내용을 모두 입력해 주세요.' },
        { status: 400 }
      );
    }
    if (subject.length > MAX_SUBJECT || body.length > MAX_BODY) {
      return NextResponse.json(
        { success: false, error: '제목이나 내용이 너무 깁니다.' },
        { status: 400 }
      );
    }

    const [recipients, config] = await Promise.all([
      recipientsFor(response),
      loadMailConfig(),
    ]);
    const addresses = resolvePickedAddresses(recipients, keys);
    if (!addresses.length) {
      return NextResponse.json(
        { success: false, error: '보낼 주소를 하나 이상 골라 주세요.' },
        { status: 400 }
      );
    }

    const state = sendability(config, recipients);
    if (state.reason === 'no-provider') {
      return NextResponse.json(
        {
          success: false,
          error:
            '메일 발송이 아직 설정되지 않았습니다. 관리자에게 이메일 설정(발신 주소·API 키)을 요청해 주세요.',
        },
        { status: 409 }
      );
    }
    if (state.reason === 'switch-off') {
      return NextResponse.json(
        {
          success: false,
          error:
            '이메일 설정에서 ‘신청 건 개별 메시지’ 발송이 꺼져 있습니다. 관리자에게 켜 달라고 요청해 주세요.',
        },
        { status: 409 }
      );
    }

    // 이미 고른 주소로만 보낸다(수신거부·형식 검사는 후보를 만들 때 끝났다).
    // directEmails로 넘기는 이유: 회원 id로 넘기면 파이프라인이 보호자를 자동으로
    // 더한다 — 화면에서 끈 보호자에게 메일이 가는 일이 생긴다.
    const result = await notifyEvent(EVENT_KEY, {
      audiences: ['user'],
      directEmails: addresses,
      data: { title: subject, message: body },
      attachments,
    });

    // 첨부는 이미 메일에 실렸다 — 공개 주소에 남겨 두지 않는다.
    await discardTempFiles(tempKeys);

    const staffId = session?.user?.id ?? null;
    const staffName = session?.user?.name ?? null;

    // 처리 이력에 한 줄 남긴다 — "이 신청에 무슨 일이 있었나"가 한 줄기로 읽혀야
    // 한다. 자동 문장이므로 메모 요약 칸(internal_note)은 건드리지 않는다.
    if (result.sent > 0) {
      const attachedLine = attachments.length
        ? `\n첨부: ${describeAttachments(attachments.map((a) => ({ name: a.filename, size: a.size })))}`
        : '';
      await addResponseNote({
        responseId,
        kind: 'mail',
        body:
          `메일을 보냈습니다 — “${subject}”\n받는 사람: ${addresses.join(', ')}` +
          attachedLine +
          (result.failed > 0 ? `\n(실패 ${result.failed}건)` : ''),
        authorId: staffId,
        authorName: staffName,
        system: true,
      }).catch((e) => console.error('메시지 이력 기록 실패:', e));
    }

    const failedTo = result.outcomes
      .filter((o) => o.status !== 'sent')
      .map((o) => o.to);

    if (result.sent === 0) {
      const blocked = result.quotaBlocked > 0;
      return NextResponse.json({
        success: false,
        error: blocked
          ? '오늘 보낼 수 있는 메일 수를 다 썼습니다. 내일 다시 시도하거나 관리자에게 한도를 확인해 주세요.'
          : `메일을 보내지 못했습니다 (${failedTo.join(', ') || '수신자 없음'}). 잠시 뒤 다시 시도해 주세요.`,
        data: result,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        sentTo: result.outcomes.filter((o) => o.status === 'sent').map((o) => o.to),
        message:
          `${result.sent}명에게 보냈습니다.` +
          (result.failed > 0 ? ` (${failedTo.join(', ')}에게는 실패했습니다.)` : ''),
      },
    });
  } catch (error) {
    console.error('신청 메시지 발송 오류:', error);
    return NextResponse.json({ success: false, error: '보내지 못했습니다.' }, { status: 500 });
  }
}
