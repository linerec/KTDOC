/**
 * Google(Gemini) 어댑터 — generateContent API
 *
 * 규약 차이: contents/parts 구조, systemInstruction 필드,
 * generationConfig.maxOutputTokens, 이미지는 inline_data(base64),
 * JSON 모드는 responseMimeType: application/json.
 */

import type {
  AiChatRequest,
  AiChatResult,
  AiImageRequest,
  AiImageResult,
  AiModelInfo,
  AiModelParamProfile,
} from '@/types/ai';
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

/**
 * 이미지 생성 — Nano Banana(gemini-*-flash-image / *-pro-image)
 *
 * 텍스트와 **같은 generateContent**를 쓴다. 다른 점은 두 가지뿐이다:
 *  - responseModalities에 IMAGE를 넣어 이미지를 받겠다고 알린다
 *  - 응답 parts에서 text가 아니라 inlineData(base64)를 꺼낸다
 * 그래서 어댑터를 새로 만들지 않고 여기 함수 하나를 더한다.
 *
 * 저장은 하지 않는다 — 호출부가 R2에 올리든 파일로 쓰든 정한다.
 */
export async function generateImageGoogle(
  cfg: AiProviderConfig,
  model: string,
  req: AiImageRequest
): Promise<AiImageResult> {
  const key = requireKey(cfg);

  const parts: GooglePart[] = [];
  for (const img of req.images ?? []) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.dataBase64 } });
  }
  // 이미지 모델은 systemInstruction을 받지 않는 경우가 있어 프롬프트 앞에 병합한다.
  const prompt = req.system ? `${req.system}\n\n---\n\n${req.prompt}` : req.prompt;
  parts.push({ text: prompt });

  const res = await fetch(
    `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
      cache: 'no-store',
      // 이미지 생성은 텍스트보다 오래 걸린다
      signal: AbortSignal.timeout(120_000),
    }
  );
  if (!res.ok) {
    throw new Error(`이미지 생성 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: {
      content?: {
        parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[];
      };
      finishReason?: string;
    }[];
  };

  const responseParts = data.candidates?.[0]?.content?.parts ?? [];
  const image = responseParts.find((p) => p.inlineData?.data);
  if (!image?.inlineData?.data) {
    // 안전 필터에 걸리면 이미지 없이 설명만 온다 — 조용히 넘기지 말고 사유를 보여 준다
    const said = responseParts.map((p) => p.text ?? '').join(' ').trim();
    throw new Error(
      `모델이 이미지를 돌려주지 않았습니다${data.candidates?.[0]?.finishReason ? ` (${data.candidates[0].finishReason})` : ''}` +
        (said ? `: ${said.slice(0, 200)}` : '. 프롬프트가 안전 필터에 걸렸을 수 있습니다.')
    );
  }

  return {
    mimeType: image.inlineData.mimeType || 'image/png',
    dataBase64: image.inlineData.data,
    provider: 'google',
    model,
    text: responseParts.map((p) => p.text ?? '').join('').trim() || undefined,
  };
}
