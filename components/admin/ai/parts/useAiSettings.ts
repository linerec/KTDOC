'use client';

/**
 * AI 설정 화면의 상태 — 제공자 키, 모델 카탈로그, 용도별 지정
 *
 * 세 가지를 한 번에 불러와 한곳에 둔다. 화면 조각(ProviderGrid·PurposeRow)은
 * 이 훅이 내주는 값만 그린다.
 *
 * API 키 원본은 서버에만 있다 — 여기서 다루는 것은 마스킹된 미리보기뿐이고,
 * 저장할 때만 새로 입력한 키를 보낸다(비워 두면 기존 키가 유지된다).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AI_PROVIDERS,
  AI_PROVIDER_LABELS,
  type AiAssignment,
  type AiModelCatalog,
  type AiProviderKey,
  type AiProviderPublicConfig,
} from '@/types/ai';
import { AI_PURPOSES } from '@/lib/ai/registry';
import { useT, type TFunction } from '@/lib/i18n/useT';

export type PublicProviders = Record<AiProviderKey, AiProviderPublicConfig>;

/** 편집 중 지정 행 — 오버라이드는 JSON 문자열로 다루고 저장 시 파싱한다 */
export interface AssignmentDraft {
  provider: AiProviderKey | '';
  model: string;
  profileOverridesText: string;
  paramOverridesText: string;
}

export interface TestState {
  running: boolean;
  ok?: boolean;
  message?: string;
}

export function draftFromAssignment(a?: AiAssignment): AssignmentDraft {
  return {
    provider: a?.provider ?? '',
    model: a?.model ?? '',
    profileOverridesText: a?.profileOverrides ? JSON.stringify(a.profileOverrides, null, 2) : '',
    paramOverridesText: a?.paramOverrides ? JSON.stringify(a.paramOverrides, null, 2) : '',
  };
}

function parseJsonField(
  t: TFunction,
  label: string,
  text: string
): Record<string, unknown> | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    const obj = JSON.parse(trimmed);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('객체가 아님');
    return obj as Record<string, unknown>;
  } catch {
    throw new Error(
      t('admin.ai.badJson', '{label}의 JSON 형식이 올바르지 않습니다.', { label })
    );
  }
}

export function useAiSettings() {
  const t = useT();

  const [providers, setProviders] = useState<PublicProviders | null>(null);
  const [catalog, setCatalog] = useState<AiModelCatalog>({ models: {}, fetchedAt: {} });
  const [drafts, setDrafts] = useState<Record<string, AssignmentDraft>>({});
  const [customModel, setCustomModel] = useState<Record<string, boolean>>({});

  // 제공자 카드 입력값(키는 입력 시에만 전송)
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [baseUrlInputs, setBaseUrlInputs] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>(''); // 'provider:openai' | 'refresh:openai' | 'assignments'
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tests, setTests] = useState<Record<string, TestState>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, mRes, aRes] = await Promise.all([
        fetch('/api/admin/ai/providers'),
        fetch('/api/admin/ai/models'),
        fetch('/api/admin/ai/assignments'),
      ]);
      const [p, m, a] = await Promise.all([pRes.json(), mRes.json(), aRes.json()]);
      if (!p.success || !m.success || !a.success) {
        throw new Error(
          p.error || m.error || a.error || t('admin.ai.loadFailed', '설정을 불러오지 못했습니다.')
        );
      }
      setProviders(p.providers as PublicProviders);
      setCatalog(m.catalog as AiModelCatalog);
      const nextDrafts: Record<string, AssignmentDraft> = {};
      for (const purpose of AI_PURPOSES) {
        nextDrafts[purpose.key] = draftFromAssignment(
          (a.assignments as Record<string, AiAssignment>)[purpose.key]
        );
      }
      setDrafts(nextDrafts);
      setBaseUrlInputs({ local: (p.providers as PublicProviders).local.baseUrl });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.ai.loadFailed', '설정을 불러오지 못했습니다.')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setError('');
    window.setTimeout(() => setNotice(''), 4000);
  };

  async function saveProvider(
    provider: AiProviderKey,
    patch: { enabled?: boolean; clearKey?: boolean }
  ) {
    setBusy(`provider:${provider}`);
    setError('');
    try {
      const res = await fetch('/api/admin/ai/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: keyInputs[provider] || undefined,
          baseUrl: provider === 'local' ? (baseUrlInputs.local ?? '') : undefined,
          ...patch,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('admin.common.saveFailed', '저장에 실패했습니다.'));
      }
      setProviders((prev) => (prev ? { ...prev, [provider]: data.provider } : prev));
      setKeyInputs((prev) => ({ ...prev, [provider]: '' }));
      flash(
        t('admin.ai.providerSaved', '{name} 설정을 저장했습니다.', {
          name: AI_PROVIDER_LABELS[provider],
        })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.saveFailed', '저장에 실패했습니다.')
      );
    } finally {
      setBusy('');
    }
  }

  async function refreshModels(provider: AiProviderKey) {
    setBusy(`refresh:${provider}`);
    setError('');
    try {
      const res = await fetch('/api/admin/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('admin.ai.refreshFailed', '최신화에 실패했습니다.'));
      }
      setCatalog(data.catalog as AiModelCatalog);
      const count = (data.catalog as AiModelCatalog).models[provider]?.length ?? 0;
      flash(
        t('admin.ai.modelsFetched', '{name} 모델 {n}개를 받아왔습니다.', {
          name: AI_PROVIDER_LABELS[provider],
          n: count,
        })
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.ai.refreshFailed', '최신화에 실패했습니다.')
      );
    } finally {
      setBusy('');
    }
  }

  const setDraft = (purpose: string, patch: Partial<AssignmentDraft>) =>
    setDrafts((prev) => ({ ...prev, [purpose]: { ...prev[purpose], ...patch } }));

  async function saveAssignments() {
    setBusy('assignments');
    setError('');
    try {
      const assignments: Record<string, Partial<AiAssignment>> = {};
      for (const purpose of AI_PURPOSES) {
        const d = drafts[purpose.key];
        if (!d || !d.provider || !d.model.trim()) continue;
        const label = t(`admin.aiPurpose.${purpose.key}.label`, purpose.label);
        assignments[purpose.key] = {
          provider: d.provider,
          model: d.model.trim(),
          profileOverrides: parseJsonField(
            t,
            t('admin.ai.profileOverrideOf', '"{label}"의 프로파일 오버라이드', { label }),
            d.profileOverridesText
          ) as AiAssignment['profileOverrides'],
          paramOverrides: parseJsonField(
            t,
            t('admin.ai.paramOverrideOf', '"{label}"의 파라미터 오버라이드', { label }),
            d.paramOverridesText
          ),
        };
      }
      const res = await fetch('/api/admin/ai/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('admin.common.saveFailed', '저장에 실패했습니다.'));
      }
      flash(t('admin.ai.assignmentsSaved', '용도별 모델 지정을 저장했습니다.'));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.saveFailed', '저장에 실패했습니다.')
      );
    } finally {
      setBusy('');
    }
  }

  async function testAssignment(purposeKey: string) {
    const d = drafts[purposeKey];
    if (!d?.provider || !d.model.trim()) {
      setTests((prev) => ({
        ...prev,
        [purposeKey]: {
          running: false,
          ok: false,
          message: t('admin.ai.pickFirst', '제공자와 모델을 먼저 선택해 주세요.'),
        },
      }));
      return;
    }
    setTests((prev) => ({ ...prev, [purposeKey]: { running: true } }));
    try {
      const body = {
        provider: d.provider,
        model: d.model.trim(),
        profileOverrides: parseJsonField(
          t,
          t('admin.ai.profileOverride', '프로파일 오버라이드'),
          d.profileOverridesText
        ),
        paramOverrides: parseJsonField(
          t,
          t('admin.ai.paramOverride', '파라미터 오버라이드'),
          d.paramOverridesText
        ),
      };
      const res = await fetch('/api/admin/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('admin.ai.testFailed', '테스트에 실패했습니다.'));
      }
      setTests((prev) => ({
        ...prev,
        [purposeKey]: {
          running: false,
          ok: true,
          message: t('admin.ai.testOk', '응답({ms}ms): {text}', {
            ms: data.elapsedMs,
            text: data.text,
          }),
        },
      }));
    } catch (err) {
      setTests((prev) => ({
        ...prev,
        [purposeKey]: {
          running: false,
          ok: false,
          message:
            err instanceof Error ? err.message : t('admin.ai.testFailed', '테스트에 실패했습니다.'),
        },
      }));
    }
  }

  const enabledProviders = useMemo(
    () => AI_PROVIDERS.filter((p) => providers?.[p]?.enabled),
    [providers]
  );

  return {
    providers,
    catalog,
    drafts,
    setDraft,
    customModel,
    setCustomModel,
    keyInputs,
    setKeyInputs,
    baseUrlInputs,
    setBaseUrlInputs,
    loading,
    busy,
    error,
    notice,
    tests,
    enabledProviders,
    saveProvider,
    refreshModels,
    saveAssignments,
    testAssignment,
  };
}
