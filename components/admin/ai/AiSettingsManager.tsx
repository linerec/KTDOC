'use client';

/**
 * AI 설정 매니저 — 제공자 API 키(D1) · 모델 카탈로그 최신화 · 용도별 모델 지정.
 *
 * 흐름: ① 제공자 키 저장 → ② "모델 목록 최신화"로 최신 모델을 카탈로그에 캐시
 *      → ③ 용도별로 제공자·모델 선택(+필요 시 고급 오버라이드) → 저장 → 테스트.
 * API 키 원본은 서버에만 있고 여기서는 마스킹된 미리보기만 다룬다.
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
import { resolveModelProfile } from '@/lib/ai/quirks';

type PublicProviders = Record<AiProviderKey, AiProviderPublicConfig>;

/** 편집 중 지정 행 — 오버라이드는 JSON 문자열로 다루고 저장 시 파싱한다 */
interface AssignmentDraft {
  provider: AiProviderKey | '';
  model: string;
  profileOverridesText: string;
  paramOverridesText: string;
}

interface TestState {
  running: boolean;
  ok?: boolean;
  message?: string;
}

const CUSTOM_MODEL = '__custom__';

function draftFromAssignment(a?: AiAssignment): AssignmentDraft {
  return {
    provider: a?.provider ?? '',
    model: a?.model ?? '',
    profileOverridesText: a?.profileOverrides ? JSON.stringify(a.profileOverrides, null, 2) : '',
    paramOverridesText: a?.paramOverrides ? JSON.stringify(a.paramOverrides, null, 2) : '',
  };
}

function parseJsonField(label: string, text: string): Record<string, unknown> | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    const obj = JSON.parse(trimmed);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('객체가 아님');
    return obj as Record<string, unknown>;
  } catch {
    throw new Error(`${label}의 JSON 형식이 올바르지 않습니다.`);
  }
}

function formatFetchedAt(iso?: string): string {
  if (!iso) return '아직 최신화하지 않음';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AiSettingsManager() {
  const [providers, setProviders] = useState<PublicProviders | null>(null);
  const [catalog, setCatalog] = useState<AiModelCatalog>({ models: {}, fetchedAt: {} });
  const [drafts, setDrafts] = useState<Record<string, AssignmentDraft>>({});
  const [customModel, setCustomModel] = useState<Record<string, boolean>>({});

  // 제공자 카드 입력값(키는 입력 시에만 전송)
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [baseUrlInputs, setBaseUrlInputs] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>(''); // 'provider:openai' | 'refresh:openai' | 'assignments' | 'test:purpose'
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
        throw new Error(p.error || m.error || a.error || '설정을 불러오지 못했습니다.');
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
      setError(err instanceof Error ? err.message : '설정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const flash = (msg: string) => {
    setNotice(msg);
    setError('');
    window.setTimeout(() => setNotice(''), 4000);
  };

  /* ── 제공자 저장/최신화 ─────────────────────────────────────────── */

  async function saveProvider(provider: AiProviderKey, patch: { enabled?: boolean; clearKey?: boolean }) {
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
      if (!res.ok || !data.success) throw new Error(data.error || '저장에 실패했습니다.');
      setProviders((prev) => (prev ? { ...prev, [provider]: data.provider } : prev));
      setKeyInputs((prev) => ({ ...prev, [provider]: '' }));
      flash(`${AI_PROVIDER_LABELS[provider]} 설정을 저장했습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
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
      if (!res.ok || !data.success) throw new Error(data.error || '최신화에 실패했습니다.');
      setCatalog(data.catalog as AiModelCatalog);
      const count = (data.catalog as AiModelCatalog).models[provider]?.length ?? 0;
      flash(`${AI_PROVIDER_LABELS[provider]} 모델 ${count}개를 받아왔습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '최신화에 실패했습니다.');
    } finally {
      setBusy('');
    }
  }

  /* ── 용도별 지정 ────────────────────────────────────────────────── */

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
        assignments[purpose.key] = {
          provider: d.provider,
          model: d.model.trim(),
          profileOverrides: parseJsonField(
            `"${purpose.label}"의 프로파일 오버라이드`,
            d.profileOverridesText
          ) as AiAssignment['profileOverrides'],
          paramOverrides: parseJsonField(
            `"${purpose.label}"의 파라미터 오버라이드`,
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
      if (!res.ok || !data.success) throw new Error(data.error || '저장에 실패했습니다.');
      flash('용도별 모델 지정을 저장했습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setBusy('');
    }
  }

  async function testAssignment(purposeKey: string) {
    const d = drafts[purposeKey];
    if (!d?.provider || !d.model.trim()) {
      setTests((prev) => ({
        ...prev,
        [purposeKey]: { running: false, ok: false, message: '제공자와 모델을 먼저 선택해 주세요.' },
      }));
      return;
    }
    setTests((prev) => ({ ...prev, [purposeKey]: { running: true } }));
    try {
      const body = {
        provider: d.provider,
        model: d.model.trim(),
        profileOverrides: parseJsonField('프로파일 오버라이드', d.profileOverridesText),
        paramOverrides: parseJsonField('파라미터 오버라이드', d.paramOverridesText),
      };
      const res = await fetch('/api/admin/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '테스트에 실패했습니다.');
      setTests((prev) => ({
        ...prev,
        [purposeKey]: {
          running: false,
          ok: true,
          message: `응답(${data.elapsedMs}ms): ${data.text}`,
        },
      }));
    } catch (err) {
      setTests((prev) => ({
        ...prev,
        [purposeKey]: {
          running: false,
          ok: false,
          message: err instanceof Error ? err.message : '테스트에 실패했습니다.',
        },
      }));
    }
  }

  /* ── 렌더 ───────────────────────────────────────────────────────── */

  const enabledProviders = useMemo(
    () => AI_PROVIDERS.filter((p) => providers?.[p]?.enabled),
    [providers]
  );

  if (loading) {
    return <div className="admin-empty-state"><p>설정을 불러오는 중...</p></div>;
  }

  return (
    <div className="ai-settings">
      {error && <div className="admin-inline-error">{error}</div>}
      {notice && <div className="ai-notice" role="status">{notice}</div>}

      {/* ── 1. 제공자(API 키) ─────────────────────────────────────── */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">1. 제공자 · API 키</h2>
        <p className="admin-form-help">
          API 키는 데이터베이스(D1)에 저장되며, 저장 후에는 마스킹된 앞·뒷자리만 표시됩니다.
          키를 바꾸려면 새 키를 입력하고 저장하세요(비워 두면 기존 키 유지).
        </p>

        <div className="ai-provider-grid">
          {AI_PROVIDERS.map((p) => {
            const cfg = providers?.[p];
            if (!cfg) return null;
            const models = catalog.models[p] ?? [];
            const rowBusy = busy === `provider:${p}` || busy === `refresh:${p}`;
            return (
              <div key={p} className="ai-provider-card">
                <div className="ai-provider-head">
                  <strong>{AI_PROVIDER_LABELS[p]}</strong>
                  <label className="ai-provider-enabled">
                    <input
                      type="checkbox"
                      checked={cfg.enabled}
                      disabled={rowBusy}
                      onChange={(e) => saveProvider(p, { enabled: e.target.checked })}
                    />
                    사용
                  </label>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label" htmlFor={`ai-key-${p}`}>
                    API 키 {p === 'local' && <span className="ai-muted">(로컬 서버는 선택)</span>}
                  </label>
                  <input
                    id={`ai-key-${p}`}
                    type="password"
                    className="admin-form-input"
                    value={keyInputs[p] ?? ''}
                    onChange={(e) => setKeyInputs((prev) => ({ ...prev, [p]: e.target.value }))}
                    placeholder={cfg.hasKey ? `저장됨 · ${cfg.keyPreview} — 새 키 입력 시 교체` : '키를 입력하세요'}
                    autoComplete="off"
                    disabled={rowBusy}
                  />
                </div>

                {p === 'local' && (
                  <div className="admin-form-group">
                    <label className="admin-form-label" htmlFor="ai-baseurl-local">
                      베이스 URL (OpenAI 호환)
                    </label>
                    <input
                      id="ai-baseurl-local"
                      type="url"
                      className="admin-form-input"
                      value={baseUrlInputs.local ?? ''}
                      onChange={(e) => setBaseUrlInputs((prev) => ({ ...prev, local: e.target.value }))}
                      placeholder="예: http://localhost:1234/v1"
                      disabled={rowBusy}
                    />
                    <p className="admin-form-help">LM Studio · Ollama · vLLM 등의 OpenAI 호환 엔드포인트.</p>
                  </div>
                )}

                <div className="admin-btn-row ai-provider-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-primary"
                    disabled={rowBusy}
                    onClick={() => saveProvider(p, {})}
                  >
                    {busy === `provider:${p}` ? '저장 중...' : '저장'}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-outline"
                    disabled={rowBusy}
                    onClick={() => refreshModels(p)}
                    title="제공자 API에서 최신 모델 목록을 받아 캐시합니다"
                  >
                    {busy === `refresh:${p}` ? '최신화 중...' : '모델 목록 최신화'}
                  </button>
                  {cfg.hasKey && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-outline"
                      disabled={rowBusy}
                      onClick={() => {
                        if (window.confirm(`${AI_PROVIDER_LABELS[p]}의 저장된 키를 삭제할까요?`)) {
                          saveProvider(p, { clearKey: true });
                        }
                      }}
                    >
                      키 삭제
                    </button>
                  )}
                </div>

                <p className="ai-provider-meta">
                  모델 {models.length}개 · 최신화: {formatFetchedAt(catalog.fetchedAt[p])}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 2. 용도별 모델 지정 ───────────────────────────────────── */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">2. 용도별 모델 지정</h2>
        <p className="admin-form-help">
          사이트의 각 AI 기능(용도)이 어떤 제공자·모델을 쓸지 지정합니다. 용도를 지정하지
          않으면 &quot;일반 질의 (기본)&quot; 지정으로 폴백합니다. 브랜드·버전별 파라미터 차이는
          모델 이름으로 자동 판별하며, 예외는 아래 고급 오버라이드로 바로잡을 수 있습니다.
        </p>

        {AI_PURPOSES.map((purpose) => {
          const d = drafts[purpose.key] ?? draftFromAssignment();
          const models = d.provider ? (catalog.models[d.provider] ?? []) : [];
          const inCatalog = models.some((m) => m.id === d.model);
          const useCustom = customModel[purpose.key] || (Boolean(d.model) && !inCatalog);
          const profile =
            d.provider && d.model ? resolveModelProfile(d.provider, d.model) : null;
          const visionWarn = Boolean(purpose.needsVision && profile && !profile.supportsVision);
          const test = tests[purpose.key];

          return (
            <div key={purpose.key} className="ai-purpose">
              <div className="ai-purpose-head">
                <strong>{purpose.label}</strong>
                <code className="ai-purpose-key">{purpose.key}</code>
                {purpose.needsVision && <span className="ai-badge">이미지 입력</span>}
                {purpose.needsJson && <span className="ai-badge">JSON 출력</span>}
              </div>
              <p className="ai-purpose-desc">{purpose.description}</p>

              <div className="ai-purpose-row">
                <select
                  className="admin-filter-select"
                  value={d.provider}
                  onChange={(e) => {
                    setDraft(purpose.key, {
                      provider: e.target.value as AiProviderKey | '',
                      model: '',
                    });
                    setCustomModel((prev) => ({ ...prev, [purpose.key]: false }));
                  }}
                >
                  <option value="">제공자 선택...</option>
                  {AI_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {AI_PROVIDER_LABELS[p]}
                      {enabledProviders.includes(p) ? '' : ' (비활성)'}
                    </option>
                  ))}
                </select>

                {!useCustom ? (
                  <select
                    className="admin-filter-select ai-model-select"
                    value={inCatalog ? d.model : ''}
                    disabled={!d.provider}
                    onChange={(e) => {
                      if (e.target.value === CUSTOM_MODEL) {
                        setCustomModel((prev) => ({ ...prev, [purpose.key]: true }));
                        return;
                      }
                      setDraft(purpose.key, { model: e.target.value });
                    }}
                  >
                    <option value="">
                      {models.length ? '모델 선택...' : '모델 없음 — 먼저 목록을 최신화하세요'}
                    </option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                    <option value={CUSTOM_MODEL}>직접 입력...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    className="admin-form-input ai-model-select"
                    value={d.model}
                    placeholder="모델 ID 직접 입력"
                    onChange={(e) => setDraft(purpose.key, { model: e.target.value })}
                    onBlur={() => {
                      if (!d.model) setCustomModel((prev) => ({ ...prev, [purpose.key]: false }));
                    }}
                  />
                )}

                <button
                  type="button"
                  className="admin-btn admin-btn-sm admin-btn-outline"
                  disabled={test?.running}
                  onClick={() => testAssignment(purpose.key)}
                >
                  {test?.running ? '테스트 중...' : '테스트'}
                </button>
              </div>

              {visionWarn && (
                <p className="ai-warn">
                  이 용도는 이미지 입력이 필요한데, 선택한 모델은 비전 미지원으로 판별됩니다.
                  비전 지원 모델을 선택하거나, 실제로 지원한다면 아래 프로파일 오버라이드에{' '}
                  <code>{'{"supportsVision": true}'}</code>를 지정하세요.
                </p>
              )}

              {profile && (
                <p className="ai-profile-line">
                  자동 판별: {profile.maxTokensParam}
                  {' · '}temperature {profile.supportsTemperature ? '지원' : '미지원'}
                  {' · '}시스템 {profile.systemStyle}
                  {' · '}비전 {profile.supportsVision ? '지원' : '미지원'}
                  {' · '}JSON {profile.supportsJsonMode ? '네이티브' : '지시문 폴백'}
                </p>
              )}

              <details className="ai-advanced">
                <summary>고급 — 버전별 파라미터 오버라이드</summary>
                <div className="ai-advanced-grid">
                  <div className="admin-form-group">
                    <label className="admin-form-label">프로파일 오버라이드 (JSON)</label>
                    <textarea
                      className="admin-form-input ai-json-input"
                      rows={3}
                      value={d.profileOverridesText}
                      onChange={(e) => setDraft(purpose.key, { profileOverridesText: e.target.value })}
                      placeholder={'예: {"maxTokensParam": "max_completion_tokens", "supportsTemperature": false}'}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">요청 파라미터 오버라이드 (JSON)</label>
                    <textarea
                      className="admin-form-input ai-json-input"
                      rows={3}
                      value={d.paramOverridesText}
                      onChange={(e) => setDraft(purpose.key, { paramOverridesText: e.target.value })}
                      placeholder={'예: {"reasoning_effort": "low"} — 요청 본문에 그대로 병합됩니다'}
                    />
                  </div>
                </div>
              </details>

              {test && !test.running && (
                <p className={`ai-test-result ${test.ok ? 'is-ok' : 'is-fail'}`}>{test.message}</p>
              )}
            </div>
          );
        })}

        <div className="admin-domain-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={busy === 'assignments'}
            onClick={saveAssignments}
          >
            {busy === 'assignments' ? '저장 중...' : '용도별 지정 저장'}
          </button>
        </div>
      </section>
    </div>
  );
}
