/**
 * Anthropic(Claude) 어댑터 — Messages API
 *
 * 규약 차이: system은 요청 본문 최상위 필드, max_tokens 필수, 이미지는
 * base64 source 블록. 버전 헤더(anthropic-version)를 고정해 호환성을 유지한다.
 */

import type { AiChatRequest, AiChatResult, AiModelInfo, AiModelParamProfile } from '@/types/ai';
import type { AiProviderConfig } from '../settings';

const BASE = 'https://api.anthropic.com/v1';
const VERSION = '2023-06-01';

function headers(cfg: AiProviderConfig): Record<string, string> {
  if (!cfg.apiKey) throw new Error('Anthropic API 키가 설정되지 않았습니다.');
  return {
    'Content-Type': 'application/json',
    'x-api-key': cfg.apiKey,
    'anthropic-version': VERSION,
  };
}

/** GET /models — 최신 모델 목록 */
export async function listAnthropicModels(cfg: AiProviderConfig): Promise<AiModelInfo[]> {
  const res = await fetch(`${BASE}/models?limit=100`, { headers: headers(cfg), cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`모델 목록 조회 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: { id?: string; display_name?: string }[] };
  return (data.data ?? [])
    .filter((m): m is { id: string; display_name?: string } => typeof m.id === 'string')
    .map((m) => ({ id: m.id, label: m.display_name || m.id }));
}

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export async function chatAnthropic(
  cfg: AiProviderConfig,
  model: string,
  req: AiChatRequest,
  profile: AiModelParamProfile,
  paramOverrides?: Record<string, unknown>
): Promise<AiChatResult> {
  const content: AnthropicContentBlock[] = [];
  if (req.images?.length) {
    if (!profile.supportsVision) {
      throw new Error(`모델 ${model}은(는) 이미지 입력을 지원하지 않는 것으로 설정되어 있습니다.`);
    }
    for (const img of req.images) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mimeType, data: img.dataBase64 },
      });
    }
  }
  // JSON 네이티브 모드가 없어 지시문으로 강제하고 호출부(extractJson)가 파싱한다
  const prompt =
    req.json && !profile.supportsJsonMode
      ? `${req.prompt}\n\n반드시 유효한 JSON만 출력하세요. JSON 밖의 설명 문장은 쓰지 마세요.`
      : req.prompt;
  content.push({ type: 'text', text: prompt });

  const body: Record<string, unknown> = {
    model,
    max_tokens: req.maxTokens ?? 1024, // Anthropic은 필수 파라미터
    messages: [{ role: 'user', content }],
  };
  if (req.system) {
    if (profile.systemStyle === 'prepend') {
      // 프로파일 오버라이드로 병합을 강제한 경우
      (body.messages as { content: AnthropicContentBlock[] }[])[0].content.unshift({
        type: 'text',
        text: `${req.system}\n\n---`,
      });
    } else {
      body.system = req.system; // 기본: 최상위 필드
    }
  }
  if (profile.supportsTemperature && req.temperature !== undefined) {
    body.temperature = req.temperature;
  }
  Object.assign(body, paramOverrides);

  const res = await fetch(`${BASE}/messages`, {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`AI 질의 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
  return {
    text,
    provider: 'anthropic',
    model,
    usage: {
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    },
  };
}
