/**
 * 메일 발송 내역 — D1
 *
 * 사용량 집계의 1차 근거다. Resend가 BCC 수신자도 각각 1통으로 세므로
 * 여기도 수신자당 1행이어야 게이지가 실제 잔량과 일치한다. API 호출 수로
 * 세면 화면은 "12통"인데 provider는 한도 초과를 반환하는 상태가 된다.
 *
 * '오늘'은 사이트 시간대로 판단한다 — UTC로 재면 학원 시간 저녁에
 * 카운터가 넘어가 하루가 어긋난다(lib/siteDay.ts와 같은 이유).
 */

import { queryD1, executeD1, batchD1 } from './client';
import { dayInTimeZone, siteDayUtcRange } from '@/lib/siteDay';
import type {
  MailAudience,
  MailLogRow,
  MailLogStatus,
  MailUsage,
} from '@/types/mail';

export interface MailLogInsert {
  eventKey: string;
  audience: MailAudience;
  toAddress: string;
  subject: string;
  body?: string | null;
  status: MailLogStatus;
  detail?: string | null;
  provider?: string | null;
  providerId?: string | null;
  batchId?: string | null;
  quotaDaily?: number | null;
  quotaMonthly?: number | null;
}

const INSERT_SQL = `
  INSERT INTO mail_log
    (event_key, audience, to_address, subject, body, status, detail,
     provider, provider_id, batch_id, quota_daily, quota_monthly)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function insertParams(r: MailLogInsert): unknown[] {
  return [
    r.eventKey,
    r.audience,
    r.toAddress,
    r.subject.slice(0, 500),
    r.body ?? null,
    r.status,
    r.detail?.slice(0, 1000) ?? null,
    r.provider ?? null,
    r.providerId ?? null,
    r.batchId ?? null,
    r.quotaDaily ?? null,
    r.quotaMonthly ?? null,
  ];
}

/** 여러 행을 한 번에. 로그 쓰기 실패가 발송 흐름을 깨지 않게 삼킨다. */
export async function insertMailLogs(rows: MailLogInsert[]): Promise<void> {
  if (!rows.length) return;
  try {
    if (rows.length === 1) {
      await executeD1(INSERT_SQL, insertParams(rows[0]));
      return;
    }
    await batchD1(rows.map((r) => ({ sql: INSERT_SQL, params: insertParams(r) })));
  } catch (error) {
    console.error('[mail] 발송 로그 저장 실패:', error);
  }
}

/**
 * 오늘/이번 달 발송 수(status='sent' 행 수).
 *
 * created_at은 datetime('now') = UTC다. 문자열 접두사로 오늘을 세면 학원
 * 저녁에 찍힌 발송이 UTC로 다음 날이라 오늘 집계에서 빠진다 — 그래서
 * 하루 경계는 siteDayUtcRange로 환산해 구간 비교한다.
 *
 * 월 집계는 접두사 비교로 둔다. 월 경계에서 최대 몇 시간이 어긋나지만
 * 월 한도(3,000)는 여유가 크고, 매달 하루치를 정확히 맞추려 구간을 12번
 * 계산하는 값이 그만큼 크지 않다.
 */
export async function getUsageCounts(timeZone: string): Promise<MailUsage> {
  const siteToday = dayInTimeZone(new Date(), timeZone); // 'YYYY-MM-DD'
  const monthPrefix = siteToday.slice(0, 7); // 'YYYY-MM'
  const { start, end } = siteDayUtcRange(siteToday, timeZone);

  const rows = await queryD1<{ daily: number | null; monthly: number | null }>(
    `SELECT
       SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) AS daily,
       SUM(CASE WHEN substr(created_at, 1, 7) = ? THEN 1 ELSE 0 END) AS monthly
     FROM mail_log
     WHERE status = 'sent'`,
    [start, end, monthPrefix]
  );
  return {
    dailySent: Number(rows[0]?.daily ?? 0),
    monthlySent: Number(rows[0]?.monthly ?? 0),
  };
}

/** 오늘 이 이벤트가 이미 나갔는가 — 한도 경고를 하루 한 번으로 묶는 데 쓴다. */
export async function wasEventSentToday(
  eventKey: string,
  timeZone: string
): Promise<boolean> {
  const siteToday = dayInTimeZone(new Date(), timeZone);
  const { start, end } = siteDayUtcRange(siteToday, timeZone);
  const rows = await queryD1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM mail_log
      WHERE event_key = ? AND status = 'sent'
        AND created_at >= ? AND created_at < ?`,
    [eventKey, start, end]
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export interface MailLogSearch {
  /** 'YYYY-MM-DD' 이상 */
  from?: string;
  /** 'YYYY-MM-DD' 이하 */
  to?: string;
  eventKey?: string;
  status?: MailLogStatus;
  /** 수신자 주소 또는 제목 부분일치 */
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function searchMailLog(params: MailLogSearch): Promise<{
  rows: MailLogRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, Math.trunc(params.page || 1));
  const pageSize = Math.min(200, Math.max(1, Math.trunc(params.pageSize || 50)));
  const where: string[] = [];
  const args: unknown[] = [];

  if (params.from) {
    where.push('substr(created_at, 1, 10) >= ?');
    args.push(params.from);
  }
  if (params.to) {
    where.push('substr(created_at, 1, 10) <= ?');
    args.push(params.to);
  }
  if (params.eventKey) {
    where.push('event_key = ?');
    args.push(params.eventKey);
  }
  if (params.status) {
    where.push('status = ?');
    args.push(params.status);
  }
  if (params.q?.trim()) {
    where.push('(to_address LIKE ? OR subject LIKE ?)');
    const like = `%${params.q.trim()}%`;
    args.push(like, like);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countRows = await queryD1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM mail_log ${clause}`,
    args
  );
  const rows = await queryD1<MailLogRow>(
    `SELECT * FROM mail_log ${clause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );
  return { rows, total: Number(countRows[0]?.n ?? 0), page, pageSize };
}

export async function getMailLogById(id: number): Promise<MailLogRow | null> {
  if (!Number.isFinite(id)) return null;
  const rows = await queryD1<MailLogRow>('SELECT * FROM mail_log WHERE id = ?', [
    id,
  ]);
  return rows[0] ?? null;
}

/** 같은 batch의 대표 행(본문을 가진 행)을 찾는다 — 단체 발송 본문 보기용. */
export async function getBatchBody(batchId: string): Promise<string | null> {
  const rows = await queryD1<{ body: string | null }>(
    `SELECT body FROM mail_log
      WHERE batch_id = ? AND body IS NOT NULL
      LIMIT 1`,
    [batchId]
  );
  return rows[0]?.body ?? null;
}

/** 보관 기간이 지난 기록 정리. 반환값은 삭제된 행 수. */
export async function purgeMailLogOlderThan(days: number): Promise<number> {
  const n = Math.max(1, Math.trunc(days));
  const result = await executeD1(
    `DELETE FROM mail_log WHERE created_at < datetime('now', ?)`,
    [`-${n} days`]
  );
  return result.changes;
}
