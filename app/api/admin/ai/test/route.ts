/**
 * AI 지정 테스트 API — 저장 전 조합(제공자+모델+오버라이드)을 실제로 질의해 본다.
 *
 * 짧은 테스트 프롬프트를 보내 응답 텍스트·토큰 사용량을 돌려준다.
 * 어댑터·프로파일 경로를 askAI와 동일하게 타므로 "저장하면 실제로 동작하는지"를
 * 그대로 검증한다. 관리자 전용.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { AI_PROVIDERS, type AiAssignment } from '@/types/ai';
import { dispatchChat, resolveModelProfile } from '@/lib/ai';
import { loadAiConfig } from '@/lib/ai/settings';

const TEST_PROMPT =
  '연결 테스트입니다. "정상 연결"이라는 문구를 포함해 한 문장으로만 답해 주세요.';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Partial<AiAssignment> & { prompt?: string };
    if (!body.provider || !(AI_PROVIDERS as readonly string[]).includes(body.provider) || !body.model) {
      return NextResponse.json(
        { success: false, error: '제공자와 모델을 먼저 선택해 주세요.' },
        { status: 400 }
      );
    }

    const { providers } = await loadAiConfig(true);
    const cfg = providers[body.provider];
    const profile = resolveModelProfile(body.provider, body.model, body.profileOverrides);

    const started = Date.now();
    const result = await dispatchChat(
      body.provider,
      cfg,
      body.model,
      { prompt: body.prompt?.trim() || TEST_PROMPT, maxTokens: 200 },
      profile,
      body.paramOverrides
    );

    return NextResponse.json({
      success: true,
      text: result.text.slice(0, 500),
      usage: result.usage,
      elapsedMs: Date.now() - started,
      profile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '테스트 질의에 실패했습니다.';
    console.error('AI test error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
