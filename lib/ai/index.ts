/**
 * AI(LLM) 공용 모듈 — 사이트 어디서든(서버) 한 함수로 질의한다
 *
 *   const result = await askAI('poster.extract', {
 *     prompt: '이 포스터에서 이벤트 정보를 JSON으로 추출해 주세요. ...',
 *     images: [{ mimeType: 'image/jpeg', dataBase64 }],
 *     json: true,
 *   });
 *
 * 흐름: 용도(purpose) → 관리자 지정(D1 ai.assignments) → 제공자 설정(D1, API 키)
 *      → 모델 프로파일 판별(quirks: 브랜드·버전별 파라미터 차이 흡수)
 *      → 제공자 어댑터 호출 → 정규화된 결과 반환.
 *
 * 관리는 /admin/ai에서: API 키 저장(D1), 모델 목록 최신화, 용도별 모델 지정.
 * ⚠️ 서버 전용(D1·API 키 접근). 클라이언트 컴포넌트에서 import 금지 —
 *    클라이언트는 서버 액션/라우트를 통해 사용한다.
 */

import type {
  AiChatRequest,
  AiChatResult,
  AiImageRequest,
  AiImageResult,
  AiModelCatalog,
  AiProviderKey,
} from '@/types/ai';
import { chatAnthropic, listAnthropicModels } from './adapters/anthropic';
import { chatGoogle, generateImageGoogle, listGoogleModels } from './adapters/google';
import { chatOpenAi, listOpenAiModels } from './adapters/openai';
import { getAiPurpose } from './registry';
import { resolveModelProfile } from './quirks';
import { loadAiConfig, saveCatalog, type AiProviderConfig } from './settings';

export { AI_PURPOSES, getAiPurpose, isKnownAiPurpose } from './registry';
export { resolveModelProfile } from './quirks';

/**
 * 용도 키로 LLM에 질의한다. 해당 용도가 미지정이면 'general' 지정으로 폴백하고,
 * 그것도 없으면 명확한 오류를 던진다(호출부는 try/catch로 비필수 기능 처리).
 */
export async function askAI(purposeKey: string, request: AiChatRequest): Promise<AiChatResult> {
  const purpose = getAiPurpose(purposeKey);
  if (!purpose) {
    throw new Error(`알 수 없는 AI 용도입니다: ${purposeKey} (lib/ai/registry.ts에 먼저 등록하세요)`);
  }

  const { providers, assignments } = await loadAiConfig();
  const assignment = assignments[purposeKey] ?? assignments['general'];
  if (!assignment) {
    throw new Error(
      `AI 용도 "${purpose.label}"에 지정된 모델이 없습니다. 관리 콘솔 > AI 설정에서 모델을 지정해 주세요.`
    );
  }

  const cfg = providers[assignment.provider];
  if (!cfg?.enabled) {
    throw new Error(`제공자(${assignment.provider})가 비활성 상태입니다. 관리 콘솔 > AI 설정을 확인해 주세요.`);
  }

  const profile = resolveModelProfile(
    assignment.provider,
    assignment.model,
    assignment.profileOverrides
  );

  return dispatchChat(assignment.provider, cfg, assignment.model, request, profile, assignment.paramOverrides);
}

/**
 * 용도 키로 **이미지를 생성**한다. askAI()와 같은 길(용도 → 관리자 지정 → 제공자 키)을
 * 쓰되 반환이 이미지다. 저장은 하지 않는다 — 호출부가 R2에 올릴지 파일로 쓸지 정한다.
 *
 * 지금은 Google(Nano Banana)만 지원한다. 다른 제공자는 이미지가 완전히 다른
 * 엔드포인트라 어댑터를 새로 써야 하는데, 필요해지면 그때 더한다.
 */
export async function generateImage(
  purposeKey: string,
  request: AiImageRequest
): Promise<AiImageResult> {
  const purpose = getAiPurpose(purposeKey);
  if (!purpose) {
    throw new Error(`알 수 없는 AI 용도입니다: ${purposeKey} (lib/ai/registry.ts에 먼저 등록하세요)`);
  }
  if (!purpose.producesImage) {
    throw new Error(
      `용도 "${purpose.label}"은(는) 이미지 생성 용도가 아닙니다. registry에 producesImage를 표시하거나 askAI()를 쓰세요.`
    );
  }

  const { providers, assignments } = await loadAiConfig();
  // 이미지 용도는 'general'로 폴백하지 않는다 — 텍스트 모델이 지정돼 있으면 실패만 늘어난다
  const assignment = assignments[purposeKey];
  if (!assignment) {
    throw new Error(
      `AI 용도 "${purpose.label}"에 지정된 모델이 없습니다. 관리 콘솔 > AI 설정에서 이미지 생성 모델을 지정해 주세요.`
    );
  }
  if (assignment.provider !== 'google') {
    throw new Error(
      `이미지 생성은 현재 Google(Nano Banana)만 지원합니다. 지정된 제공자: ${assignment.provider}`
    );
  }

  const cfg = providers.google;
  if (!cfg?.enabled) {
    throw new Error('Google 제공자가 비활성 상태입니다. 관리 콘솔 > AI 설정을 확인해 주세요.');
  }

  return generateImageGoogle(cfg, assignment.model, request);
}

/** 제공자 분기 — 테스트 API가 지정 저장 전 임시 조합을 시험할 때도 재사용한다 */
export async function dispatchChat(
  provider: AiProviderKey,
  cfg: AiProviderConfig,
  model: string,
  request: AiChatRequest,
  profile = resolveModelProfile(provider, model),
  paramOverrides?: Record<string, unknown>
): Promise<AiChatResult> {
  switch (provider) {
    case 'anthropic':
      return chatAnthropic(cfg, model, request, profile, paramOverrides);
    case 'google':
      return chatGoogle(cfg, model, request, profile, paramOverrides);
    case 'openai':
    case 'local':
      return chatOpenAi(provider, cfg, model, request, profile, paramOverrides);
  }
}

/**
 * 제공자의 최신 모델 목록을 받아 카탈로그(D1)에 저장하고 돌려준다.
 * — 관리 화면의 "모델 목록 최신화" 버튼이 호출한다.
 */
export async function refreshModelCatalog(provider: AiProviderKey): Promise<AiModelCatalog> {
  const { providers, catalog } = await loadAiConfig(true);
  const cfg = providers[provider];

  const models =
    provider === 'anthropic'
      ? await listAnthropicModels(cfg)
      : provider === 'google'
        ? await listGoogleModels(cfg)
        : await listOpenAiModels(provider, cfg);

  const next: AiModelCatalog = {
    models: { ...catalog.models, [provider]: models },
    fetchedAt: { ...catalog.fetchedAt, [provider]: new Date().toISOString() },
  };
  await saveCatalog(next);
  return next;
}

/**
 * JSON 출력 용도 보조 — 네이티브 JSON 모드가 없는 모델(코드펜스·설명이 섞인
 * 응답)에서도 첫 JSON 객체/배열을 안전하게 파싱한다.
 */
export function extractJson<T = unknown>(text: string): T {
  // 코드펜스 제거 후 첫 { 또는 [부터 짝이 맞는 지점까지 시도
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error('AI 응답에서 JSON을 찾지 못했습니다.');
  const candidate = cleaned.slice(start);
  // 뒤에서부터 줄여가며 파싱 시도(뒤에 붙은 설명 문장 제거)
  for (let end = candidate.length; end > 0; end--) {
    const ch = candidate[end - 1];
    if (ch !== '}' && ch !== ']') continue;
    try {
      return JSON.parse(candidate.slice(0, end)) as T;
    } catch {
      // 더 짧게 재시도
    }
  }
  throw new Error('AI 응답의 JSON 파싱에 실패했습니다.');
}
