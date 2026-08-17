/**
 * 메일 설정 API — GET(마스킹 조회) / PUT(부분 저장)
 *
 * 시크릿은 응답에 담지 않고(…Set 불리언만), 빈 값으로 덮어쓰지 않는다.
 * 주소 형식이 틀리면 400으로 거절한다 — 조용히 버리면 운영자는 저장됐다고
 * 믿고, 메일은 어디에도 가지 않는다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { isValidEmail, toPublicMailConfig } from '@/lib/mail/config';
import { loadMailConfig, saveMailConfig } from '@/lib/mail/store';
import { resolveMailConfig } from '@/lib/mail/mailer';
import { getUsageCounts } from '@/lib/d1/mailLog';
import { getCalendarConfig } from '@/lib/calendar';

function forbidden() {
  return NextResponse.json(
    { success: false, error: '관리자 권한이 필요합니다.' },
    { status: 403 }
  );
}

export async function GET() {
  try {
    const session = await auth();
    if (!isAdmin(session)) return forbidden();

    const config = await loadMailConfig();
    const { timezone } = await getCalendarConfig();
    // 내역 테이블이 아직 없거나 D1이 흔들려도 설정 화면은 열려야 한다.
    const usage = await getUsageCounts(timezone).catch(() => ({
      dailySent: 0,
      monthlySent: 0,
    }));
    const resolved = resolveMailConfig(config);

    return NextResponse.json({
      success: true,
      config: toPublicMailConfig(config),
      usage,
      // 지금 실제로 어떤 경로로 나가는지 — 환경변수 폴백까지 반영된 결과
      effective:
        resolved.provider === 'none'
          ? { ready: false, reason: resolved.reason }
          : {
              ready: true,
              provider: resolved.provider,
              from: resolved.from,
              fromName: resolved.fromName,
              replyTo: resolved.replyTo,
            },
    });
  } catch (error) {
    console.error('메일 설정 GET 오류:', error);
    return NextResponse.json(
      { success: false, error: '설정 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) return forbidden();

    const body = (await request.json()) as Record<string, unknown>;

    // 주소 검증 — 틀리면 저장하지 않는다
    for (const field of ['from', 'replyTo'] as const) {
      const v = body[field];
      if (typeof v === 'string' && v.trim() && !isValidEmail(v)) {
        return NextResponse.json(
          { success: false, error: `주소 형식이 올바르지 않습니다: ${v}` },
          { status: 400 }
        );
      }
    }
    if (Array.isArray(body.staffTo)) {
      const bad = body.staffTo.find(
        (v) => typeof v !== 'string' || (v.trim() !== '' && !isValidEmail(v))
      );
      if (bad !== undefined) {
        return NextResponse.json(
          {
            success: false,
            error: `운영진 주소 형식이 올바르지 않습니다: ${String(bad)}`,
          },
          { status: 400 }
        );
      }
    }

    const saved = await saveMailConfig(body);
    return NextResponse.json({
      success: true,
      config: toPublicMailConfig(saved),
    });
  } catch (error) {
    console.error('메일 설정 PUT 오류:', error);
    return NextResponse.json(
      { success: false, error: '설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
