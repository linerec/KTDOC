/**
 * 발송 내역 검색 — GET /api/admin/mail/log
 *
 * 쿼리: from, to, eventKey, status, q, page, pageSize
 *       id=<n> 이면 단건 상세(본문 포함)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getBatchBody, getMailLogById, searchMailLog } from '@/lib/d1/mailLog';
import { getMailEvent } from '@/lib/mail/events';
import type { MailLogStatus } from '@/types/mail';

const STATUSES: MailLogStatus[] = ['sent', 'failed', 'skipped', 'quota_blocked'];

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');

    if (idParam) {
      const row = await getMailLogById(Number(idParam));
      if (!row) {
        return NextResponse.json(
          { success: false, error: '기록을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      // 단체 발송은 대표 행에만 본문이 있다 — 같은 batch에서 끌어온다.
      const body =
        row.body ?? (row.batch_id ? await getBatchBody(row.batch_id) : null);
      const def = getMailEvent(row.event_key);
      return NextResponse.json({
        success: true,
        row: { ...row, body },
        // 본문이 없는 이유를 화면이 구분할 수 있게: 보안상 미저장인가, 그냥 없는가
        redacted: def?.redactBody === true,
      });
    }

    const statusParam = url.searchParams.get('status');
    const result = await searchMailLog({
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      eventKey: url.searchParams.get('eventKey') || undefined,
      status: STATUSES.includes(statusParam as MailLogStatus)
        ? (statusParam as MailLogStatus)
        : undefined,
      q: url.searchParams.get('q') || undefined,
      page: Number(url.searchParams.get('page') || 1),
      pageSize: Number(url.searchParams.get('pageSize') || 50),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('메일 내역 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '내역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
