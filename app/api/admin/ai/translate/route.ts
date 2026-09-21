/**
 * POST /api/admin/ai/translate — 한국어 칸들을 영어 초벌로 옮긴다
 *
 * 입력: `{ fields: [{ key, label, ko }, …] }`
 * 출력: `{ success, translations: { key: 영문 }, skipped: [key] }`
 *
 * AI 용도는 **'text.polish'(문구 다듬기 · 번역 보조)** 하나다 — 관리 콘솔 >
 * AI 설정에서 지정한 모델을 쓴다. 지정이 없으면 'general'로 폴백하고, 그것도
 * 없으면 askAI가 "AI 설정에서 모델을 지정해 주세요"라고 말한다.
 *
 * 판단(프롬프트·응답 해석)은 `lib/ai/translate.ts`에 있고 시험이 붙어 있다.
 * 여기는 권한 확인과 질의뿐이다.
 *
 * ── 번역은 저장하지 않는다 ────────────────────────────────────────────────
 * 결과를 DB에 바로 쓰지 않고 폼에만 채운다. 기계 번역이 사람의 확인 없이 학부모에게
 * 나가는 길을 만들지 않으려는 것이다 — 채워진 값은 초안이고, 저장 버튼이 확정이다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { askAI, extractJson } from '@/lib/ai';
import {
  TRANSLATE_SYSTEM,
  buildTranslatePrompt,
  normalizeFields,
  pickTranslations,
} from '@/lib/ai/translate';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { fields?: unknown };
    const fields = normalizeFields(body.fields);
    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: '옮길 한국어 내용이 없습니다.' },
        { status: 400 }
      );
    }

    // 출력은 입력과 비슷한 길이 + 용어 설명 괄호가 붙으므로 넉넉히 잡는다.
    const inputChars = fields.reduce((sum, f) => sum + f.ko.length, 0);
    const maxTokens = Math.min(8000, Math.max(1200, Math.ceil(inputChars * 2.5)));

    const result = await askAI('text.polish', {
      system: TRANSLATE_SYSTEM,
      prompt: buildTranslatePrompt(fields),
      json: true,
      maxTokens,
      temperature: 0.2,
    });

    let parsed: unknown;
    try {
      parsed = extractJson(result.text);
    } catch {
      // 출력이 잘렸으면 원인이 토큰 상한이다 — 사람이 고칠 수 있는 말로 알린다.
      const truncated = result.finishReason && /length|max_tokens/i.test(result.finishReason);
      return NextResponse.json(
        {
          success: false,
          error: truncated
            ? '번역 결과가 너무 길어 중간에 끊겼습니다. 내용을 나눠서 다시 시도해 주세요.'
            : '번역 결과를 해석하지 못했습니다. 다시 시도해 주세요.',
        },
        { status: 502 }
      );
    }

    const translations = pickTranslations(parsed, fields);
    const skipped = fields.map((f) => f.key).filter((key) => !(key in translations));

    if (Object.keys(translations).length === 0) {
      return NextResponse.json(
        { success: false, error: '번역된 내용을 받지 못했습니다. 다시 시도해 주세요.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      translations,
      skipped,
      model: `${result.provider} · ${result.model}`,
    });
  } catch (error) {
    // askAI가 던지는 오류는 이미 사람이 읽을 수 있는 한국어 안내다
    // (모델 미지정·제공자 비활성 등) — 그대로 전달한다.
    const message = error instanceof Error ? error.message : '번역에 실패했습니다.';
    console.error('AI translate error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
