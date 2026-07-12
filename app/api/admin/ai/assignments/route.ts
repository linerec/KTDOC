/**
 * AI 용도별 모델 지정 API — GET / POST(전체 저장)
 *
 * 용도(purpose)는 코드 레지스트리(lib/ai/registry.ts)가 SSOT이고,
 * 여기서는 각 용도에 어떤 제공자·모델·오버라이드를 쓸지만 저장한다. 관리자 전용.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { AI_PROVIDERS, type AiAssignment, type AiAssignments } from '@/types/ai';
import { isKnownAiPurpose } from '@/lib/ai/registry';
import { loadAiConfig, saveAssignments } from '@/lib/ai/settings';

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

    const { assignments } = await loadAiConfig(true);
    return NextResponse.json({ success: true, assignments });
  } catch (error) {
    console.error('AI assignments GET error:', error);
    return NextResponse.json(
      { success: false, error: '지정 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) return forbidden();

    const body = (await request.json()) as { assignments?: Record<string, Partial<AiAssignment>> };
    if (!body.assignments || typeof body.assignments !== 'object') {
      return NextResponse.json(
        { success: false, error: '지정 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const cleaned: AiAssignments = {};
    for (const [purpose, row] of Object.entries(body.assignments)) {
      if (!isKnownAiPurpose(purpose)) {
        return NextResponse.json(
          { success: false, error: `알 수 없는 용도입니다: ${purpose}` },
          { status: 400 }
        );
      }
      // 비워진 지정(모델 미선택)은 저장하지 않는다 → askAI는 general로 폴백
      if (!row || !row.provider || !row.model) continue;
      if (!(AI_PROVIDERS as readonly string[]).includes(row.provider)) {
        return NextResponse.json(
          { success: false, error: `알 수 없는 제공자입니다: ${row.provider}` },
          { status: 400 }
        );
      }
      cleaned[purpose] = {
        provider: row.provider,
        model: String(row.model),
        ...(row.profileOverrides && typeof row.profileOverrides === 'object'
          ? { profileOverrides: row.profileOverrides }
          : {}),
        ...(row.paramOverrides && typeof row.paramOverrides === 'object'
          ? { paramOverrides: row.paramOverrides as Record<string, unknown> }
          : {}),
      };
    }

    await saveAssignments(cleaned);
    return NextResponse.json({ success: true, assignments: cleaned });
  } catch (error) {
    console.error('AI assignments POST error:', error);
    return NextResponse.json(
      { success: false, error: '지정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
