/**
 * OpenAI(ChatGPT) + GPT 호환(로컬·자체 호스팅) 어댑터
 *
 * chat/completions 규약을 쓰는 모든 서버를 담당한다. 'local' 제공자는
 * baseUrl만 다른 같은 규약(LM Studio·Ollama·vLLM 등의 OpenAI 호환 모드)이다.
 * 버전별 파라미터 차이(max_tokens vs max_completion_tokens, temperature 유무,
 * system/developer 역할)는 호출부가 넘겨주는 프로파일이 결정한다.
 */

import type { AiChatRequest, AiChatResult, AiModelInfo, AiModelParamProfile, AiProviderKey } from '@/types/ai';
import type { AiProviderConfig } from '../settings';

const OPENAI_BASE = 'https://api.openai.com/v1';

function baseUrlOf(provider: AiProviderKey, cfg: AiProviderConfig): string {
  if (provider === 'local') {
    if (!cfg.baseUrl) throw new Error('GPT 호환 서버의 베이스 URL이 설정되지 않았습니다.');
    return cfg.baseUrl;
  }
  return OPENAI_BASE;
}

function authHeaders(cfg: AiProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // 로컬 서버는 키가 없을 수 있다(있으면 그대로 Bearer로 전달)
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  return headers;
}

/** GET /models — 최신 모델 목록 (챗 모델 외 임베딩·오디오 등도 오지만 그대로 노출) */
export async function listOpenAiModels(
  provider: AiProviderKey,
  cfg: AiProviderConfig
): Promise<AiModelInfo[]> {
  const res = await fetch(`${baseUrlOf(provider, cfg)}/models`, {
    headers: authHeaders(cfg),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`모델 목록 조회 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: { id?: string }[] };
  return (data.data ?? [])
    .filter((m): m is { id: string } => typeof m.id === 'string')
    .map((m) => ({ id: m.id, label: m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

interface OpenAiMessageContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export async function chatOpenAi(
  provider: AiProviderKey,
  cfg: AiProviderConfig,
  model: string,
  req: AiChatRequest,
  profile: AiModelParamProfile,
  paramOverrides?: Record<string, unknown>
): Promise<AiChatResult> {
  const messages: { role: string; content: string | OpenAiMessageContentPart[] }[] = [];

  let prompt = req.prompt;
  if (req.system) {
    if (profile.systemStyle === 'system-role') {
      messages.push({ role: 'system', content: req.system });
    } else if (profile.systemStyle === 'developer-role') {
      messages.push({ role: 'developer', content: req.system });
    } else {
      // prepend 폴백 — system 계열 역할을 받지 않는 모델
      prompt = `${req.system}\n\n---\n\n${prompt}`;
    }
  }

  if (req.images?.length) {
    if (!profile.supportsVision) {
      throw new Error(`모델 ${model}은(는) 이미지 입력을 지원하지 않는 것으로 설정되어 있습니다.`);
    }
    const parts: OpenAiMessageContentPart[] = req.images.map((img) => ({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.dataBase64}` },
    }));
    parts.push({ type: 'text', text: prompt });
    messages.push({ role: 'user', content: parts });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    // 프로파일이 버전에 맞는 파라미터 이름을 결정한다
    [profile.maxTokensParam]: req.maxTokens ?? 1024,
  };
  if (profile.supportsTemperature && req.temperature !== undefined) {
    body.temperature = req.temperature;
  }
  if (req.json && profile.supportsJsonMode) {
    body.response_format = { type: 'json_object' };
  }
  // 관리자 지정 원문 파라미터가 항상 마지막에 이긴다(신형 모델 대응 탈출구)
  Object.assign(body, paramOverrides);

  const res = await fetch(`${baseUrlOf(provider, cfg)}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(cfg),
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`AI 질의 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    text,
    provider,
    model,
    finishReason: data.choices?.[0]?.finish_reason,
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      // 추론 모델(o시리즈 등)은 사고 토큰도 출력 예산에서 차감된다
      thinkingTokens: data.usage?.completion_tokens_details?.reasoning_tokens,
    },
  };
}
