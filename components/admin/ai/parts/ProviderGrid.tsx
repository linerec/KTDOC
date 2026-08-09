'use client';

/**
 * 제공자 · API 키 카드 그리드
 *
 * 키는 저장 후 마스킹된 앞·뒷자리만 보인다. 입력칸을 비운 채 저장하면 기존 키가 유지되므로,
 * placeholder로 "지금 저장된 키가 있다"는 사실을 알려 준다.
 */

import { AI_PROVIDERS, AI_PROVIDER_LABELS, type AiModelCatalog, type AiProviderKey } from '@/types/ai';
import { useT } from '@/lib/i18n/useT';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PublicProviders } from './useAiSettings';

interface ProviderGridProps {
  providers: PublicProviders | null;
  catalog: AiModelCatalog;
  keyInputs: Record<string, string>;
  onKeyInput: (provider: string, value: string) => void;
  baseUrlInputs: Record<string, string>;
  onBaseUrlInput: (value: string) => void;
  busy: string;
  onSave: (provider: AiProviderKey, patch: { enabled?: boolean; clearKey?: boolean }) => void;
  onRefresh: (provider: AiProviderKey) => void;
}

export default function ProviderGrid({
  providers,
  catalog,
  keyInputs,
  onKeyInput,
  baseUrlInputs,
  onBaseUrlInput,
  busy,
  onSave,
  onRefresh,
}: ProviderGridProps) {
  const t = useT();
  const { locale } = useLanguage();

  /** 마지막 최신화 시각 — 아직 없으면 그 사실을 말한다 */
  const formatFetchedAt = (iso?: string): string => {
    if (!iso) return t('admin.ai.neverFetched', '아직 최신화하지 않음');
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ko-KR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  };

  return (
    <section className="admin-form-section ai-section">
      <div className="ai-section-head">
        <h2 className="admin-form-section-title">
          {t('admin.ai.step1', '1. 제공자 · API 키')}
        </h2>
        <p className="admin-form-help">
          {t(
            'admin.ai.step1Help',
            'API 키는 데이터베이스(D1)에 저장되며, 저장 후에는 마스킹된 앞·뒷자리만 표시됩니다. 키를 바꾸려면 새 키를 입력하고 저장하세요(비워 두면 기존 키 유지).'
          )}
        </p>
      </div>

      <div className="ai-provider-grid">
        {AI_PROVIDERS.map((p) => {
          const cfg = providers?.[p];
          if (!cfg) return null;
          const models = catalog.models[p] ?? [];
          const rowBusy = busy === `provider:${p}` || busy === `refresh:${p}`;
          return (
            <div key={p} className={`ai-provider-card${cfg.enabled ? ' is-enabled' : ''}`}>
              <div className="ai-provider-head">
                <strong>{AI_PROVIDER_LABELS[p]}</strong>
                <label className="ai-provider-enabled">
                  <input
                    type="checkbox"
                    checked={cfg.enabled}
                    disabled={rowBusy}
                    onChange={(e) => onSave(p, { enabled: e.target.checked })}
                  />
                  {t('admin.ai.use', '사용')}
                </label>
              </div>

              <div className="ai-key-row">
                <input
                  id={`ai-key-${p}`}
                  type="password"
                  className="admin-form-input"
                  value={keyInputs[p] ?? ''}
                  onChange={(e) => onKeyInput(p, e.target.value)}
                  placeholder={
                    cfg.hasKey
                      ? t('admin.ai.keySaved', '저장됨 · {preview}', { preview: cfg.keyPreview })
                      : t('admin.ai.keyPlaceholder', 'API 키 입력')
                  }
                  aria-label={t('admin.ai.keyAria', '{name} API 키', {
                    name: AI_PROVIDER_LABELS[p],
                  })}
                  autoComplete="off"
                  disabled={rowBusy}
                />
                <button
                  type="button"
                  className="admin-btn admin-btn-sm admin-btn-primary"
                  disabled={rowBusy}
                  onClick={() => onSave(p, {})}
                >
                  {busy === `provider:${p}`
                    ? t('admin.ai.savingShort', '저장 중')
                    : t('admin.common.save', '저장')}
                </button>
              </div>

              {p === 'local' && (
                <div className="ai-key-row">
                  <input
                    id="ai-baseurl-local"
                    type="url"
                    className="admin-form-input"
                    value={baseUrlInputs.local ?? ''}
                    onChange={(e) => onBaseUrlInput(e.target.value)}
                    placeholder={t(
                      'admin.ai.baseUrlPlaceholder',
                      '베이스 URL — 예: http://localhost:1234/v1'
                    )}
                    aria-label={t('admin.ai.baseUrlAria', 'GPT 호환 서버 베이스 URL')}
                    disabled={rowBusy}
                  />
                </div>
              )}

              <div className="ai-provider-foot">
                <button
                  type="button"
                  className="admin-btn admin-btn-sm admin-btn-outline"
                  disabled={rowBusy}
                  onClick={() => onRefresh(p)}
                  title={t('admin.ai.refreshTitle', '제공자 API에서 최신 모델 목록을 받아 캐시합니다')}
                >
                  {busy === `refresh:${p}`
                    ? t('admin.ai.refreshing', '최신화 중...')
                    : t('admin.ai.refresh', '모델 목록 최신화')}
                </button>
                <span className="ai-provider-meta">
                  {t('admin.ai.modelCount', '모델 {n}개', { n: models.length })}
                  <span className="ai-meta-dim"> · {formatFetchedAt(catalog.fetchedAt[p])}</span>
                </span>
                {cfg.hasKey && (
                  <button
                    type="button"
                    className="ai-key-clear"
                    disabled={rowBusy}
                    onClick={() => {
                      if (
                        window.confirm(
                          t('admin.ai.clearKeyConfirm', '{name}의 저장된 키를 삭제할까요?', {
                            name: AI_PROVIDER_LABELS[p],
                          })
                        )
                      ) {
                        onSave(p, { clearKey: true });
                      }
                    }}
                  >
                    {t('admin.ai.clearKey', '키 삭제')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
