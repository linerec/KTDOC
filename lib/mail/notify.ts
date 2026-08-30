/**
 * 알림 오케스트레이션 — 각 기능이 부르는 단 하나의 입구
 *
 * 호출부는 "무슨 일이 있었는지"만 말한다. 누구에게 보낼지·보낼 수 있는지·
 * 무슨 문구인지는 전부 이 아래에서 정해진다.
 *
 * 절대 throw 하지 않는다 — 메일 실패가 가입·등록을 실패시키면 안 된다.
 * 메일에 의존하면 스팸 분류 한 번에 가입이 통째로 사라진다.
 */

import 'server-only';
import { after } from 'next/server';
import { getCalendarConfig } from '@/lib/calendar';
import { getGuardianEmailsForStudents } from '@/lib/members';
import { query } from '@/lib/db';
import { getMailEvent, isEssential, type MailEventDef } from './events';
import { loadMailConfig } from './store';
import { resolveMailConfig, sendMail } from './mailer';
import { resolveRecipients, type RecipientCandidate } from './recipients';
import { decideQuota, quotaPercent } from './quota';
import { renderMailBody, type MailTemplateData } from './templates';
import {
  getUsageCounts,
  insertMailLogs,
  wasEventSentToday,
  type MailLogInsert,
} from '@/lib/d1/mailLog';
import type {
  MailAudience,
  MailConfig,
  MailLogStatus,
  MailUsage,
} from '@/types/mail';

export interface NotifyInput {
  /** 'user' 대상의 회원 id들. 원생이면 보호자가 자동으로 더해진다. */
  userIds?: string[];
  /** 회원이 아닌 수신자(문의자 등). allowNonMember 이벤트에서 쓴다. */
  directEmails?: string[];
  /** 답장을 이 주소로 받고 싶을 때(문의 접수 → 문의자) */
  replyTo?: string;
  /** 템플릿 치환값 */
  data?: MailTemplateData;
  /**
   * 보낼 대상을 좁힌다. 비우면 이벤트가 정의한 대상 전부(보통 user + staff).
   *
   * 지나간 일을 뒤늦게 알릴 때 쓴다 — 며칠 전 배정을 이제 안내하면서
   * 학원에도 "새 등록이 있었습니다"를 보내면 방금 일어난 일로 읽힌다.
   */
  audiences?: MailAudience[];
}

/**
 * 발송 결과 요약.
 *
 * 대부분의 호출부는 이 값을 쓰지 않는다 — 가입·등록이 메일 결과에 좌우되면 안
 * 되기 때문이다. 다만 **사람이 직접 쓴 1:1 메일**은 다르다. 선생님이 '보내기'를
 * 누른 자리에서는 정말 나갔는지를 화면이 말해야 한다. 못 갔는데 "보냈습니다"를
 * 띄우면 아무도 그 사실을 모른 채 답장을 기다린다.
 */
export interface NotifyOutcome {
  audience: MailAudience;
  to: string;
  status: MailLogStatus;
  detail: string | null;
}

export interface NotifyResult {
  sent: number;
  failed: number;
  skipped: number;
  quotaBlocked: number;
  outcomes: NotifyOutcome[];
}

function emptyResult(): NotifyResult {
  return { sent: 0, failed: 0, skipped: 0, quotaBlocked: 0, outcomes: [] };
}

function summarize(logs: MailLogInsert[]): NotifyResult {
  const result = emptyResult();
  for (const log of logs) {
    if (log.status === 'sent') result.sent += 1;
    else if (log.status === 'failed') result.failed += 1;
    else if (log.status === 'quota_blocked') result.quotaBlocked += 1;
    else result.skipped += 1;
    result.outcomes.push({
      audience: log.audience,
      to: log.toAddress,
      status: log.status,
      detail: log.detail ?? null,
    });
  }
  return result;
}

interface MemberRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  email_opt_in: 0 | 1;
}

/**
 * 'user' 대상 후보를 만든다 — 당사자 + (원생이면) 연결된 보호자.
 *
 * 원생은 미성년이라 메일을 잘 보지 않는다. 수업 등록 확인이 원생에게만 가면
 * 학부모는 등록된 줄 모른다(기존 cron 리마인더도 이미 이렇게 동작한다).
 * 보호자의 수신 여부는 보호자 자신의 설정으로 판정한다 — 원생의 설정이
 * 보호자를 대신 끄면 안 된다.
 */
async function collectUserCandidates(
  userIds: string[],
  directEmails: string[]
): Promise<RecipientCandidate[]> {
  const candidates: RecipientCandidate[] = directEmails
    .filter(Boolean)
    .map((email) => ({ email }));
  if (!userIds.length) return candidates;

  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return candidates;

  const placeholders = unique.map(() => '?').join(', ');
  const members = await query<MemberRow[]>(
    `SELECT id, name, email, role, email_opt_in FROM users WHERE id IN (${placeholders})`,
    unique
  );
  for (const m of members) {
    candidates.push({ email: m.email, optIn: m.email_opt_in !== 0 });
  }

  const studentIds = members.filter((m) => m.role === 'student').map((m) => m.id);
  if (!studentIds.length) return candidates;

  const guardianMap = await getGuardianEmailsForStudents(studentIds);
  const guardianEmails = new Set<string>();
  for (const list of guardianMap.values()) {
    for (const e of list) if (e) guardianEmails.add(e);
  }
  if (!guardianEmails.size) return candidates;

  const emails = Array.from(guardianEmails);
  const ph = emails.map(() => '?').join(', ');
  const guardians = await query<{ email: string; email_opt_in: 0 | 1 }[]>(
    `SELECT email, email_opt_in FROM users WHERE email IN (${ph})`,
    emails
  );
  const optInByEmail = new Map(
    guardians.map((g) => [g.email.toLowerCase(), g.email_opt_in !== 0])
  );
  for (const email of emails) {
    candidates.push({
      email,
      optIn: optInByEmail.get(email.toLowerCase()) ?? true,
    });
  }
  return candidates;
}

/**
 * 한 이벤트의 한 대상에게 보낸다. 로그는 성공·실패·건너뜀 모두 남긴다.
 * 남긴 로그를 그대로 돌려준다 — 호출부가 "무엇이 어떻게 됐는지"를 알 수 있게.
 */
async function notifyAudience(
  def: MailEventDef,
  audience: MailAudience,
  input: NotifyInput,
  config: MailConfig,
  timeZone: string
): Promise<MailLogInsert[]> {
  if (!def.audiences.includes(audience)) return [];

  const candidates =
    audience === 'user'
      ? await collectUserCandidates(input.userIds ?? [], input.directEmails ?? [])
      : [];

  const { addresses, skipped } = resolveRecipients({
    def,
    audience,
    switches: config.events,
    candidates,
    staffTo: config.staffTo,
  });

  const body = renderMailBody(def.key, audience, input.data ?? {});
  const logs: MailLogInsert[] = skipped.map((sk) => ({
    eventKey: def.key,
    audience,
    toAddress: sk.email ?? '(주소 없음)',
    subject: body.subject,
    body: null,
    status: 'skipped',
    detail: sk.reason,
  }));

  if (!addresses.length) {
    await insertMailLogs(logs);
    return logs;
  }

  // ── 한도 판정 (수신자 수 단위)
  const essential = isEssential(def, audience);
  const usage = await getUsageCounts(timeZone);
  const decision = decideQuota(usage, config.quota, addresses.length, essential);

  if (!decision.allow) {
    logs.push(
      ...addresses.map(
        (to): MailLogInsert => ({
          eventKey: def.key,
          audience,
          toAddress: to,
          subject: body.subject,
          body: null,
          status: 'quota_blocked',
          detail: `${decision.reason}-limit`,
        })
      )
    );
    await insertMailLogs(logs);
    await maybeWarnQuota(usage, config, timeZone);
    return logs;
  }

  // ── 발송
  const resolved = resolveMailConfig(config);
  const bulk = def.bulk === true && addresses.length > 1;
  const storedBody = def.redactBody ? null : body.text;

  if (bulk) {
    // 수신자끼리 주소가 보이지 않게 BCC로. to에는 발신 주소를 넣는다.
    const batchId = `${def.key}-${Date.now()}`;
    const selfTo = resolved.provider === 'none' ? [] : [resolved.from];
    const result = await sendMail(resolved, {
      to: selfTo,
      bcc: addresses,
      subject: body.subject,
      text: body.text,
      replyTo: input.replyTo,
    });
    logs.push(
      ...addresses.map(
        (to, i): MailLogInsert => ({
          eventKey: def.key,
          audience,
          toAddress: to,
          subject: body.subject,
          // 100명분 본문 중복을 피한다 — 대표 행 하나에만 저장
          body: i === 0 ? storedBody : null,
          status: result.ok ? 'sent' : 'failed',
          detail: result.detail ?? null,
          provider: resolved.provider,
          providerId: result.providerId ?? null,
          batchId,
          quotaDaily: result.quotaDaily ?? null,
          quotaMonthly: result.quotaMonthly ?? null,
        })
      )
    );
  } else {
    for (const to of addresses) {
      const result = await sendMail(resolved, {
        to: [to],
        subject: body.subject,
        text: body.text,
        replyTo: input.replyTo,
      });
      logs.push({
        eventKey: def.key,
        audience,
        toAddress: to,
        subject: body.subject,
        body: storedBody,
        status: result.ok ? 'sent' : 'failed',
        detail: result.detail ?? null,
        provider: resolved.provider,
        providerId: result.providerId ?? null,
        quotaDaily: result.quotaDaily ?? null,
        quotaMonthly: result.quotaMonthly ?? null,
      });
    }
  }

  await insertMailLogs(logs);
  if (decision.warn) await maybeWarnQuota(usage, config, timeZone);
  return logs;
}

/**
 * 한도 경고 — 하루 한 번만. 경고 메일 자체가 한도를 먹으므로,
 * 오늘 이미 나갔으면 조용히 넘어간다.
 */
async function maybeWarnQuota(
  usage: MailUsage,
  config: MailConfig,
  timeZone: string
): Promise<void> {
  try {
    const def = getMailEvent('quota.warning');
    if (!def) return;
    if (await wasEventSentToday('quota.warning', timeZone)) return;
    await notifyAudience(
      def,
      'staff',
      {
        data: {
          percent: quotaPercent(usage.dailySent, config.quota.dailyLimit),
          dailySent: usage.dailySent,
          dailyLimit: config.quota.dailyLimit,
          monthlySent: usage.monthlySent,
          monthlyLimit: config.quota.monthlyLimit,
        },
      },
      config,
      timeZone
    );
  } catch (error) {
    console.error('[mail] 한도 경고 발송 실패:', error);
  }
}

/**
 * 이벤트 하나를 알린다. 정의된 모든 대상(user·staff)에게 순서대로.
 * 실패해도 던지지 않는다 — 결과는 반환값으로만 말한다.
 */
export async function notifyEvent(
  eventKey: string,
  input: NotifyInput = {}
): Promise<NotifyResult> {
  const logs: MailLogInsert[] = [];
  try {
    const def = getMailEvent(eventKey);
    if (!def) {
      console.warn(`[mail] 알 수 없는 이벤트: ${eventKey}`);
      return emptyResult();
    }
    const [config, calendar] = await Promise.all([
      loadMailConfig(),
      getCalendarConfig(),
    ]);
    const wanted = input.audiences;
    for (const audience of def.audiences) {
      if (wanted && !wanted.includes(audience)) continue;
      logs.push(
        ...(await notifyAudience(def, audience, input, config, calendar.timezone))
      );
    }
  } catch (error) {
    console.error(`[mail] notifyEvent(${eventKey}) 실패:`, error);
  }
  return summarize(logs);
}

/**
 * 사용자 요청에서 부를 때 — 응답을 붙잡지 않는다.
 * 메일 서버가 느려도 가입·등록 화면이 기다리지 않는다.
 *
 * cron 라우트에서는 쓰지 말 것 — 응답 후 함수가 끝나면 발송이 잘린다.
 * 거기서는 notifyEvent를 await 한다.
 */
export function notifyEventAfterResponse(
  eventKey: string,
  input: NotifyInput = {}
): void {
  try {
    after(async () => {
      await notifyEvent(eventKey, input);
    });
  } catch (error) {
    // after()는 요청 컨텍스트 밖에서 부르면 던진다 — 그때는 그냥 즉시 보낸다.
    console.warn('[mail] after() 사용 불가 — 즉시 발송으로 전환:', error);
    void notifyEvent(eventKey, input);
  }
}
