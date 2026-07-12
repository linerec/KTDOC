/**
 * 모델별 API 파라미터 프로파일 판별 — 브랜드·버전 차이를 흡수하는 계층
 *
 * 같은 브랜드라도 버전에 따라 파라미터가 다르다:
 *  - OpenAI 추론 계열(o1/o3/o4/gpt-5…)은 max_tokens 대신 max_completion_tokens를
 *    쓰고 temperature를 받지 않으며, system 대신 developer 역할을 쓴다.
 *  - Anthropic은 system이 요청 본문 최상위 필드이고 max_tokens가 필수다.
 *  - Google은 systemInstruction·generationConfig(maxOutputTokens) 구조를 쓴다.
 *
 * 아래 "규칙(정규식) → 부분 프로파일" 목록이 모델 ID로 자동 판별하고,
 * 마지막에 관리자의 profileOverrides가 덮어쓴다. 새 모델이 나와 규칙이 빗나가도
 * 관리 화면의 오버라이드만으로 코드 수정 없이 대응할 수 있고, 규칙 자체도
 * 이 파일에 한 줄 추가하면 된다.
 */

import type { AiModelParamProfile, AiProviderKey } from '@/types/ai';

/** 제공자별 기본 프로파일 — 규칙에 걸리지 않는 모델의 안전값 */
const BASE_PROFILES: Record<AiProviderKey, AiModelParamProfile> = {
  openai: {
    maxTokensParam: 'max_tokens',
    supportsTemperature: true,
    systemStyle: 'system-role',
    supportsVision: false,
    supportsJsonMode: true,
  },
  local: {
    // GPT 호환 서버(LM Studio·Ollama·vLLM 등)는 클래식 chat/completions 규약이 기본
    maxTokensParam: 'max_tokens',
    supportsTemperature: true,
    systemStyle: 'system-role',
    supportsVision: false,
    supportsJsonMode: false,
  },
  anthropic: {
    maxTokensParam: 'max_tokens',
    supportsTemperature: true,
    systemStyle: 'top-level',
    supportsVision: true, // claude-3 이후 전 모델 비전 지원
    supportsJsonMode: false, // 네이티브 JSON 모드 없음 → 지시문+파싱 폴백
  },
  google: {
    maxTokensParam: 'max_tokens', // 어댑터에서 generationConfig.maxOutputTokens로 매핑
    supportsTemperature: true,
    systemStyle: 'system-instruction',
    supportsVision: true, // gemini 1.5 이후 멀티모달 기본
    supportsJsonMode: true, // responseMimeType: application/json
  },
};

interface QuirkRule {
  provider: AiProviderKey;
  /** 모델 ID 패턴 (소문자 비교) */
  pattern: RegExp;
  patch: Partial<AiModelParamProfile>;
}

/** 위에서 아래로 모두 적용(뒤 규칙이 앞 규칙을 덮음) — 구체적 규칙을 뒤에 둔다 */
const QUIRK_RULES: QuirkRule[] = [
  // ── OpenAI ──────────────────────────────────────────────────────────
  // 비전 지원 세대(gpt-4o·gpt-4.1·gpt-4-turbo·omni 계열)
  {
    provider: 'openai',
    pattern: /^(gpt-4o|gpt-4\.1|gpt-4-turbo|chatgpt-4o|omni)/,
    patch: { supportsVision: true },
  },
  // 추론 계열(o1/o3/o4·gpt-5~): max_completion_tokens + temperature 미지원 + developer 역할, 비전 지원
  {
    provider: 'openai',
    pattern: /^(o[0-9]|gpt-5)/,
    patch: {
      maxTokensParam: 'max_completion_tokens',
      supportsTemperature: false,
      systemStyle: 'developer-role',
      supportsVision: true,
    },
  },
  // 초기 o1 미리보기 계열은 system/developer 역할 자체를 받지 않음 → 프롬프트에 병합
  {
    provider: 'openai',
    pattern: /^o1-(mini|preview)/,
    patch: { systemStyle: 'prepend', supportsVision: false, supportsJsonMode: false },
  },

  // ── Google ──────────────────────────────────────────────────────────
  // 구세대(gemini-1.0/pro-vision 이전)는 systemInstruction 미지원 → 병합
  {
    provider: 'google',
    pattern: /^gemini-1\.0|^gemini-pro/,
    patch: { systemStyle: 'prepend' },
  },

  // ── GPT 호환 로컬 ────────────────────────────────────────────────────
  // 로컬 비전 모델 관례 이름(llava·vl·vision 포함)
  {
    provider: 'local',
    pattern: /llava|vision|-vl/,
    patch: { supportsVision: true },
  },
];

/**
 * 제공자+모델 ID로 파라미터 프로파일을 판별한다.
 * overrides(관리자 지정)가 있으면 마지막에 덮어쓴다.
 */
export function resolveModelProfile(
  provider: AiProviderKey,
  modelId: string,
  overrides?: Partial<AiModelParamProfile>
): AiModelParamProfile {
  const id = modelId.toLowerCase();
  let profile = { ...BASE_PROFILES[provider] };
  for (const rule of QUIRK_RULES) {
    if (rule.provider === provider && rule.pattern.test(id)) {
      profile = { ...profile, ...rule.patch };
    }
  }
  return { ...profile, ...overrides };
}
