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

    const payload = (await request.json().catch(() => null)) as {
      subject?: unknown;
      body?: unknown;
      to?: unknown;
    } | null;

    const subject = typeof payload?.subject === 'string' ? payload.subject.trim() : '';
    const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
    const keys = Array.isArray(payload?.to)
      ? payload.to.filter((k): k is string => typeof k === 'string')
      : [];

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
    });

    const staffId = session?.user?.id ?? null;
    const staffName = session?.user?.name ?? null;

    // 처리 이력에 한 줄 남긴다 — "이 신청에 무슨 일이 있었나"가 한 줄기로 읽혀야
    // 한다. 자동 문장이므로 메모 요약 칸(internal_note)은 건드리지 않는다.
    if (result.sent > 0) {
      await addResponseNote({
        responseId,
        kind: 'mail',
        body:
          `메일을 보냈습니다 — “${subject}”\n받는 사람: ${addresses.join(', ')}` +
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
