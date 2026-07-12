/**
 * AI 설정 저장소 — D1 site_settings에 저장 (서버 전용, 클라 import 금지)
 *
 *  - ai.providers   : 제공자별 API 키·베이스 URL·사용 여부 (⚠️ 시크릿 포함)
 *  - ai.models      : 제공자별 모델 카탈로그 캐시(+최신화 시각)
 *  - ai.assignments : 용도(purpose)별 모델 지정
 *
 * API 키는 요구사항에 따라 .env가 아니라 DB(D1)에 저장한다. 전체 키는
 * 서버에서만 읽고, 클라이언트에는 마스킹된 미리보기(keyPreview)만 내려보낸다.
 */

import { getSettings, setSetting } from '@/lib/d1';
import {
  AI_PROVIDERS,
  type AiAssignment,
  type AiAssignments,
  type AiModelCatalog,
  type AiModelInfo,
  type AiProviderKey,
  type AiProviderPublicConfig,
} from '@/types/ai';
import { isKnownAiPurpose } from './registry';

export const SETTING_AI_PROVIDERS = 'ai.providers';
export const SETTING_AI_MODELS = 'ai.models';
export const SETTING_AI_ASSIGNMENTS = 'ai.assignments';

/** 서버 내부용 제공자 설정(전체 키 포함) — 절대 그대로 클라이언트에 반환 금지 */
export interface AiProviderConfig {
  enabled: boolean;
  apiKey: string;
  /** local(GPT 호환) 전용 OpenAI 호환 베이스 URL (예: http://localhost:1234/v1) */
  baseUrl: string;
}

export type AiProviderConfigs = Record<AiProviderKey, AiProviderConfig>;

const EMPTY_PROVIDER: AiProviderConfig = { enabled: false, apiKey: '', baseUrl: '' };

function isProviderKey(value: unknown): value is AiProviderKey {
  return typeof value === 'string' && (AI_PROVIDERS as readonly string[]).includes(value);
}

function parseProviders(raw: string | null): AiProviderConfigs {
  const result = Object.fromEntries(
    AI_PROVIDERS.map((p) => [p, { ...EMPTY_PROVIDER }])
  ) as AiProviderConfigs;
  if (!raw) return result;
  try {
    const obj = JSON.parse(raw) as Record<string, Partial<AiProviderConfig>>;
    for (const p of AI_PROVIDERS) {
      const row = obj[p];
      if (!row || typeof row !== 'object') continue;
      result[p] = {
        enabled: row.enabled === true,
        apiKey: typeof row.apiKey === 'string' ? row.apiKey : '',
        baseUrl: typeof row.baseUrl === 'string' ? row.baseUrl.trim().replace(/\/+$/, '') : '',
      };
    }
  } catch {
    // 손상된 설정은 빈 값으로 — 관리 화면에서 다시 저장하면 복구된다
  }
  return result;
}

function parseCatalog(raw: string | null): AiModelCatalog {
  if (!raw) return { models: {}, fetchedAt: {} };
  try {
    const obj = JSON.parse(raw) as AiModelCatalog;
    const models: AiModelCatalog['models'] = {};
    const fetchedAt: AiModelCatalog['fetchedAt'] = {};
    for (const p of AI_PROVIDERS) {
      const list = obj.models?.[p];
      if (Array.isArray(list)) {
        models[p] = list
          .filter((m): m is AiModelInfo => Boolean(m && typeof m.id === 'string'))
          .map((m) => ({ id: m.id, label: typeof m.label === 'string' && m.label ? m.label : m.id }));
      }
      const at = obj.fetchedAt?.[p];
      if (typeof at === 'string') fetchedAt[p] = at;
    }
    return { models, fetchedAt };
  } catch {
    return { models: {}, fetchedAt: {} };
  }
}

function parseAssignments(raw: string | null): AiAssignments {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, Partial<AiAssignment>>;
    const result: AiAssignments = {};
    for (const [purpose, row] of Object.entries(obj)) {
      if (!isKnownAiPurpose(purpose)) continue; // 폐기된 용도는 무시(레지스트리가 SSOT)
      if (!row || !isProviderKey(row.provider) || typeof row.model !== 'string' || !row.model) continue;
      result[purpose] = {
        provider: row.provider,
        model: row.model,
        ...(row.profileOverrides && typeof row.profileOverrides === 'object'
          ? { profileOverrides: row.profileOverrides }
          : {}),
        ...(row.paramOverrides && typeof row.paramOverrides === 'object'
          ? { paramOverrides: row.paramOverrides as Record<string, unknown> }
          : {}),
      };
    }
    return result;
  } catch {
    return {};
  }
}

export interface AiConfigBundle {
  providers: AiProviderConfigs;
  catalog: AiModelCatalog;
  assignments: AiAssignments;
}

/**
 * AI 설정 일괄 로드. askAI가 질의마다 D1을 때리지 않도록 짧은 TTL로 캐시한다.
 * (관리 화면 저장 API는 저장 후 invalidateAiConfigCache()를 호출)
 */
let cache: { bundle: AiConfigBundle; at: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function loadAiConfig(fresh = false): Promise<AiConfigBundle> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.bundle;
  const settings = await getSettings([
    SETTING_AI_PROVIDERS,
    SETTING_AI_MODELS,
    SETTING_AI_ASSIGNMENTS,
  ]);
  const bundle: AiConfigBundle = {
    providers: parseProviders(settings[SETTING_AI_PROVIDERS] ?? null),
    catalog: parseCatalog(settings[SETTING_AI_MODELS] ?? null),
    assignments: parseAssignments(settings[SETTING_AI_ASSIGNMENTS] ?? null),
  };
  cache = { bundle, at: Date.now() };
  return bundle;
}

export function invalidateAiConfigCache(): void {
  cache = null;
}

export async function saveProviders(providers: AiProviderConfigs): Promise<void> {
  await setSetting(SETTING_AI_PROVIDERS, JSON.stringify(providers));
  invalidateAiConfigCache();
}

export async function saveCatalog(catalog: AiModelCatalog): Promise<void> {
  await setSetting(SETTING_AI_MODELS, JSON.stringify(catalog));
  invalidateAiConfigCache();
}

export async function saveAssignments(assignments: AiAssignments): Promise<void> {
  await setSetting(SETTING_AI_ASSIGNMENTS, JSON.stringify(assignments));
  invalidateAiConfigCache();
}

/** "sk-abc…1234" 형태의 마스킹 미리보기 — 전체 키는 클라이언트로 보내지 않는다 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return `${key.slice(0, 2)}…`;
  return `${key.slice(0, 5)}…${key.slice(-4)}`;
}

export function toPublicProviderConfig(cfg: AiProviderConfig): AiProviderPublicConfig {
  return {
    enabled: cfg.enabled,
    hasKey: Boolean(cfg.apiKey),
    keyPreview: maskApiKey(cfg.apiKey),
    baseUrl: cfg.baseUrl,
  };
}
