/**
 * Google(Gemini) 어댑터 — generateContent API
 *
 * 규약 차이: contents/parts 구조, systemInstruction 필드,
 * generationConfig.maxOutputTokens, 이미지는 inline_data(base64),
 * JSON 모드는 responseMimeType: application/json.
 */

import type { AiChatRequest, AiChatResult, AiModelInfo, AiModelParamProfile } from '@/types/ai';
import type { AiProviderConfig } from '../settings';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

function requireKey(cfg: AiProviderConfig): string {
  if (!cfg.apiKey) throw new Error('Google API 키가 설정되지 않았습니다.');
  return cfg.apiKey;
}

/** GET /models — 최신 모델 목록 (generateContent 지원 모델만) */
export async function listGoogleModels(cfg: AiProviderConfig): Promise<AiModelInfo[]> {
  const key = requireKey(cfg);
  const res = await fetch(`${BASE}/models?pageSize=200&key=${encodeURIComponent(key)}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`모델 목록 조회 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[];
  };
  return (data.models ?? [])
    .filter(
      (m): m is { name: string; displayName?: string; supportedGenerationMethods?: string[] } =>
        typeof m.name === 'string' &&
        (m.supportedGenerationMethods ?? []).includes('generateContent')
    )
    .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }));
}

type GooglePart = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function chatGoogle(
  cfg: AiProviderConfig,
  model: string,
  req: AiChatRequest,
  profile: AiModelParamProfile,
  paramOverrides?: Record<string, unknown>
): Promise<AiChatResult> {
  const key = requireKey(cfg);
  const parts: GooglePart[] = [];
  if (req.images?.length) {
    if (!profile.supportsVision) {
      throw new Error(`모델 ${model}은(는) 이미지 입력을 지원하지 않는 것으로 설정되어 있습니다.`);
    }
    for (const img of req.images) {
      parts.push({ inline_data: { mime_type: img.mimeType, data: img.dataBase64 } });
    }
  }

  let prompt = req.prompt;
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: req.maxTokens ?? 1024,
  };
  if (profile.supportsTemperature && req.temperature !== undefined) {
    generationConfig.temperature = req.temperature;
  }
  if (req.json && profile.supportsJsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [...parts, { text: '' }] }],
    generationConfig,
  };
  if (req.system) {
    if (profile.systemStyle === 'prepend') {
      // 구세대 모델 폴백 — 시스템 지시를 프롬프트 앞에 병합
      prompt = `${req.system}\n\n---\n\n${prompt}`;
    } else {
      body.systemInstruction = { parts: [{ text: req.system }] };
    }
  }
  // parts의 마지막 text를 최종 프롬프트로 채운다
  (body.contents as { parts: GooglePart[] }[])[0].parts = [...parts, { text: prompt }];
  Object.assign(body, paramOverrides);

  const res = await fetch(
    `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    }
  );
  if (!res.ok) {
    throw new Error(`AI 질의 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
    };
  };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('');
  return {
    text,
    provider: 'google',
    model,
    finishReason: data.candidates?.[0]?.finishReason,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      // Gemini 2.5+는 사고 토큰도 maxOutputTokens 예산에서 차감된다 — 응답이 잘리는 주원인
      thinkingTokens: data.usageMetadata?.thoughtsTokenCount,
    },
  };
}
