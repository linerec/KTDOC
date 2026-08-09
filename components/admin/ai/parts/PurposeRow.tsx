'use client';

/**
 * 용도 한 줄 — 어떤 AI 기능이 어떤 제공자·모델을 쓸지
 *
 * 모델 이름으로 파라미터 규격을 자동 판별해 아래에 보여 준다(quirks). 판별이 틀리는
 * 예외는 '고급'의 오버라이드로 바로잡는다 — 그래서 판별 결과를 감추지 않고 노출한다.
 * 이미지가 필요한 용도에 비전 미지원 모델을 고르면 경고가 뜬다.
 */

import { AI_PROVIDERS, AI_PROVIDER_LABELS, type AiModelCatalog, type AiProviderKey } from '@/types/ai';
import type { AiPurpose } from '@/lib/ai/registry';
import { resolveModelProfile } from '@/lib/ai/quirks';
import { useT } from '@/lib/i18n/useT';
import T from '@/components/common/T';
import type { AssignmentDraft, TestState } from './useAiSettings';

const CUSTOM_MODEL = '__custom__';

interface PurposeRowProps {
  purpose: AiPurpose;
  draft: AssignmentDraft;
  catalog: AiModelCatalog;
  enabledProviders: AiProviderKey[];
  useCustomModel: boolean;
  onCustomModel: (v: boolean) => void;
  onDraft: (patch: Partial<AssignmentDraft>) => void;
  test?: TestState;
  onTest: () => void;
}

export default function PurposeRow({
  purpose,
  draft,
  catalog,
  enabledProviders,
  useCustomModel,
  onCustomModel,
  onDraft,
  test,
  onTest,
}: PurposeRowProps) {
  const t = useT();

  const label = t(`admin.aiPurpose.${purpose.key}.label`, purpose.label);
  const description = t(`admin.aiPurpose.${purpose.key}.desc`, purpose.description);
  const models = draft.provider ? (catalog.models[draft.provider] ?? []) : [];
  const inCatalog = models.some((m) => m.id === draft.model);
  const custom = useCustomModel || (Boolean(draft.model) && !inCatalog);
  const profile =
    draft.provider && draft.model ? resolveModelProfile(draft.provider, draft.model) : null;
  const visionWarn = Boolean(purpose.needsVision && profile && !profile.supportsVision);

  const yesNo = (v: boolean) =>
    v ? t('admin.ai.supported', '지원') : t('admin.ai.unsupported', '미지원');

  return (
    <div className="ai-purpose">
      <div className="ai-purpose-grid">
        <div className="ai-purpose-info">
          <div className="ai-purpose-head">
            <strong>{label}</strong>
            {purpose.needsVision && <span className="ai-badge">{t('admin.ai.image', '이미지')}</span>}
            {purpose.needsJson && <span className="ai-badge">JSON</span>}
          </div>
          <p className="ai-purpose-desc" title={description}>
            <code className="ai-purpose-key">{purpose.key}</code> {description}
          </p>
        </div>

        <select
          className="admin-filter-select"
          aria-label={t('admin.ai.providerAria', '{label} 제공자', { label })}
          value={draft.provider}
          onChange={(e) => {
            onDraft({ provider: e.target.value as AiProviderKey | '', model: '' });
            onCustomModel(false);
          }}
        >
          <option value="">{t('admin.ai.select', '선택...')}</option>
          {AI_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {AI_PROVIDER_LABELS[p]}
              {enabledProviders.includes(p) ? '' : ` ${t('admin.ai.disabled', '(비활성)')}`}
            </option>
          ))}
        </select>

        {!custom ? (
          <select
            className="admin-filter-select"
            aria-label={t('admin.ai.modelAria', '{label} 모델', { label })}
            value={inCatalog ? draft.model : ''}
            disabled={!draft.provider}
            onChange={(e) => {
              if (e.target.value === CUSTOM_MODEL) {
                onCustomModel(true);
                return;
              }
              onDraft({ model: e.target.value });
            }}
          >
            <option value="">
              {models.length
                ? t('admin.ai.pickModel', '모델 선택...')
                : t('admin.ai.needRefresh', '목록 최신화 필요')}
            </option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
            <option value={CUSTOM_MODEL}>{t('admin.ai.enterManually', '직접 입력...')}</option>
          </select>
        ) : (
          <input
            type="text"
            className="admin-form-input"
            aria-label={t('admin.ai.modelManualAria', '{label} 모델 직접 입력', { label })}
            value={draft.model}
            placeholder={t('admin.ai.modelIdPlaceholder', '모델 ID 직접 입력')}
            onChange={(e) => onDraft({ model: e.target.value })}
            onBlur={() => {
              if (!draft.model) onCustomModel(false);
            }}
          />
        )}

        <button
          type="button"
          className="admin-btn admin-btn-sm admin-btn-outline"
          disabled={test?.running}
          onClick={onTest}
        >
          {test?.running ? t('admin.ai.testing', '테스트 중') : t('admin.ai.test', '테스트')}
        </button>
      </div>

      <div className="ai-purpose-sub">
        {profile && (
          <p className="ai-profile-line">
            {t('admin.ai.autoDetected', '자동 판별:')} {profile.maxTokensParam}
            {' · '}temperature {yesNo(profile.supportsTemperature)}
            {' · '}
            {t('admin.ai.system', '시스템')} {profile.systemStyle}
            {' · '}
            {t('admin.ai.vision', '비전')} {yesNo(profile.supportsVision)}
            {' · '}JSON{' '}
            {profile.supportsJsonMode
              ? t('admin.ai.native', '네이티브')
              : t('admin.ai.promptFallback', '지시문 폴백')}
          </p>
        )}

        {visionWarn && (
          <p className="ai-warn">
            <T
              k="admin.ai.visionWarn"
              params={{ json: <code>{'{"supportsVision": true}'}</code> }}
            >
              {'이 용도는 이미지 입력이 필요한데, 선택한 모델은 비전 미지원으로 판별됩니다. 비전 지원 모델을 선택하거나, 실제로 지원한다면 프로파일 오버라이드에 {json}를 지정하세요.'}
            </T>
          </p>
        )}

        <details className="ai-advanced">
          <summary>{t('admin.ai.advanced', '고급 — 버전별 파라미터 오버라이드')}</summary>
          <div className="ai-advanced-grid">
            <div className="admin-form-group">
              <label className="admin-form-label">
                {t('admin.ai.profileOverrideJson', '프로파일 오버라이드 (JSON)')}
              </label>
              <textarea
                className="admin-form-input ai-json-input"
                rows={3}
                value={draft.profileOverridesText}
                onChange={(e) => onDraft({ profileOverridesText: e.target.value })}
                placeholder={
                  '예: {"maxTokensParam": "max_completion_tokens", "supportsTemperature": false}'
                }
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">
                {t('admin.ai.paramOverrideJson', '요청 파라미터 오버라이드 (JSON)')}
              </label>
              <textarea
                className="admin-form-input ai-json-input"
                rows={3}
                value={draft.paramOverridesText}
                onChange={(e) => onDraft({ paramOverridesText: e.target.value })}
                placeholder={t(
                  'admin.ai.paramOverridePlaceholder',
                  '예: {"reasoning_effort": "low"} — 요청 본문에 그대로 병합됩니다'
                )}
              />
            </div>
          </div>
        </details>

        {test && !test.running && (
          <p className={`ai-test-result ${test.ok ? 'is-ok' : 'is-fail'}`}>{test.message}</p>
        )}
      </div>
    </div>
  );
}
