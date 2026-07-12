/**
 * AI 모델 카탈로그 API — GET(캐시 조회) / POST(제공자별 최신화)
 *
 * POST는 해당 제공자의 모델 목록 API를 호출해 최신 목록을 D1에 저장한다.
 * "LLM 모델 리스트 최신화 → 용도별 모델 지정" 흐름의 앞 단계. 관리자 전용.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { AI_PROVIDERS, type AiProviderKey } from '@/types/ai';
import { refreshModelCatalog } from '@/lib/ai';
import { loadAiConfig } from '@/lib/ai/settings';

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

    const { catalog } = await loadAiConfig(true);
    return NextResponse.json({ success: true, catalog });
  } catch (error) {
    console.error('AI models GET error:', error);
    return NextResponse.json(
      { success: false, error: '카탈로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) return forbidden();

    const body = (await request.json()) as { provider?: AiProviderKey };
    const provider = body.provider;
    if (!provider || !(AI_PROVIDERS as readonly string[]).includes(provider)) {
      return NextResponse.json(
        { success: false, error: '알 수 없는 제공자입니다.' },
        { status: 400 }
      );
    }

    const catalog = await refreshModelCatalog(provider);
    return NextResponse.json({ success: true, catalog });
  } catch (error) {
    // 키 미설정·네트워크 오류 등 — 어댑터의 메시지를 그대로 관리자에게 보여준다
    const message = error instanceof Error ? error.message : '모델 목록 최신화에 실패했습니다.';
    console.error('AI models refresh error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
