/**
 * AI 제공자 설정 API — GET(마스킹 조회) / POST(저장)
 *
 * API 키는 D1에 저장하고(요구사항: .env 아님), 조회 시에는 마스킹된
 * 미리보기만 반환한다. 저장 시 apiKey를 비우면 기존 키 유지,
 * clearKey: true면 삭제한다. 관리자 전용.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { AI_PROVIDERS, type AiProviderKey } from '@/types/ai';
import {
  loadAiConfig,
  saveProviders,
  toPublicProviderConfig,
} from '@/lib/ai/settings';

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

    const { providers } = await loadAiConfig(true);
    const publicConfigs = Object.fromEntries(
      AI_PROVIDERS.map((p) => [p, toPublicProviderConfig(providers[p])])
    );
    return NextResponse.json({ success: true, providers: publicConfigs });
  } catch (error) {
    console.error('AI providers GET error:', error);
    return NextResponse.json(
      { success: false, error: '설정 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

interface SaveBody {
  provider?: AiProviderKey;
  enabled?: boolean;
  apiKey?: string;
  clearKey?: boolean;
  baseUrl?: string;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) return forbidden();

    const body: SaveBody = await request.json();
    const provider = body.provider;
    if (!provider || !(AI_PROVIDERS as readonly string[]).includes(provider)) {
      return NextResponse.json(
        { success: false, error: '알 수 없는 제공자입니다.' },
        { status: 400 }
      );
    }

    const { providers } = await loadAiConfig(true);
    const current = providers[provider];
    providers[provider] = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
      // 빈 값이면 기존 키 유지 — 마스킹 조회라 클라이언트가 원본을 돌려보낼 수 없다
      apiKey: body.clearKey
        ? ''
        : typeof body.apiKey === 'string' && body.apiKey.trim()
          ? body.apiKey.trim()
          : current.apiKey,
      baseUrl:
        typeof body.baseUrl === 'string'
          ? body.baseUrl.trim().replace(/\/+$/, '')
          : current.baseUrl,
    };
    await saveProviders(providers);

    return NextResponse.json({
      success: true,
      provider: toPublicProviderConfig(providers[provider]),
    });
  } catch (error) {
    console.error('AI providers POST error:', error);
    return NextResponse.json(
      { success: false, error: '설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
