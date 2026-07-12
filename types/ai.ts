/**
 * AI(LLM) 공용 모듈 타입 — 클라이언트 안전(시크릿 없음)
 *
 * 구조 개요:
 *  - 제공자(provider): openai(ChatGPT) · anthropic(Claude) · google(Gemini) ·
 *    local(GPT 호환 로컬/자체 호스팅). API 키·엔드포인트는 D1에 저장한다(.env 아님).
 *  - 모델 카탈로그: 각 제공자 API에서 최신 모델 목록을 받아 D1에 캐시한다.
 *  - 용도(purpose): 사이트 기능별 질의 용도(lib/ai/registry.ts). 관리자가
 *    용도마다 어떤 제공자·모델을 쓸지 지정한다.
 *  - 파라미터 프로파일: 같은 브랜드라도 모델 버전에 따라 API 파라미터가 다르다
 *    (예: OpenAI 추론 계열은 max_completion_tokens, temperature 미지원).
 *    lib/ai/quirks.ts의 규칙이 모델 ID로 자동 판별하고, 관리자가 지정별로
 *    덮어쓸 수 있다(profileOverrides·paramOverrides).
 */

export const AI_PROVIDERS = ['openai', 'anthropic', 'google', 'local'] as const;
export type AiProviderKey = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AiProviderKey, string> = {
  openai: 'OpenAI (ChatGPT)',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  local: 'GPT 호환 · 로컬 모델',
};

/** 모델 카탈로그의 모델 1건 (제공자 API의 목록 응답에서 정규화) */
export interface AiModelInfo {
  id: string;
  /** 표시 이름(제공자가 주면 사용, 없으면 id) */
  label: string;
}

/** 제공자별 모델 카탈로그 + 최신화 시각 */
export interface AiModelCatalog {
  models: Partial<Record<AiProviderKey, AiModelInfo[]>>;
  fetchedAt: Partial<Record<AiProviderKey, string>>;
}

/**
 * 모델별 API 파라미터 프로파일 — 브랜드·버전 간 차이를 흡수하는 계층.
 * quirks 규칙이 자동 판별한 값을 관리자가 부분적으로 덮어쓸 수 있다.
 */
export interface AiModelParamProfile {
  /** 출력 토큰 상한 파라미터 이름 (OpenAI 추론 계열은 max_completion_tokens) */
  maxTokensParam: 'max_tokens' | 'max_completion_tokens';
  /** temperature 지원 여부 (미지원 모델엔 파라미터 자체를 보내지 않음) */
  supportsTemperature: boolean;
  /**
   * 시스템 프롬프트 전달 방식
   *  - system-role: messages 안의 system 역할 (OpenAI 클래식·GPT 호환)
   *  - developer-role: messages 안의 developer 역할 (OpenAI 추론 계열)
   *  - top-level: 요청 본문의 system 필드 (Anthropic)
   *  - system-instruction: systemInstruction 필드 (Google)
   *  - prepend: 첫 사용자 메시지 앞에 병합 (system 미지원 모델의 안전 폴백)
   */
  systemStyle: 'system-role' | 'developer-role' | 'top-level' | 'system-instruction' | 'prepend';
  /** 이미지 입력(비전) 지원 추정 */
  supportsVision: boolean;
  /** 네이티브 JSON 출력 모드 지원 (미지원이면 지시문+파싱 폴백) */
  supportsJsonMode: boolean;
}

/** 용도 1건에 대한 모델 지정 */
export interface AiAssignment {
  provider: AiProviderKey;
  model: string;
  /** 프로파일 자동 판별을 덮어쓰기 (부분 지정) */
  profileOverrides?: Partial<AiModelParamProfile>;
  /** 요청 본문에 마지막으로 병합할 제공자 원문 파라미터 (신형 모델 대응 탈출구) */
  paramOverrides?: Record<string, unknown>;
}

/** 용도 키 → 지정 (미지정 용도는 'general' 지정으로 폴백) */
export type AiAssignments = Record<string, AiAssignment>;

/** 관리 UI에 내려주는 제공자 설정(키는 마스킹된 미리보기만) */
export interface AiProviderPublicConfig {
  enabled: boolean;
  hasKey: boolean;
  /** 예: "sk-…3f9a" — 전체 키는 절대 클라이언트로 보내지 않는다 */
  keyPreview: string;
  /** local(GPT 호환) 전용: OpenAI 호환 엔드포인트 베이스 URL */
  baseUrl: string;
}

/** 공용 질의 요청 — 어느 제공자든 이 형태 하나로 질의한다 */
export interface AiChatRequest {
  prompt: string;
  system?: string;
  /** 이미지 입력(포스터 추출 등 비전 용도) */
  images?: { mimeType: string; dataBase64: string }[];
  /** true면 JSON 출력 모드(네이티브 지원 시 강제, 아니면 지시문+파싱 폴백) */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

/** 공용 질의 결과 — 제공자별 응답을 정규화 */
export interface AiChatResult {
  text: string;
  provider: AiProviderKey;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}
