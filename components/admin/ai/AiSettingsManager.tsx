'use client';

/**
 * AI 설정 매니저 — 제공자 API 키(D1) · 모델 카탈로그 최신화 · 용도별 모델 지정.
 *
 * 흐름: ① 제공자 키 저장 → ② "모델 목록 최신화"로 최신 모델을 카탈로그에 캐시
 *      → ③ 용도별로 제공자·모델 선택(+필요 시 고급 오버라이드) → 저장 → 테스트.
 *
 * 이 파일은 조립만 한다: 상태는 useAiSettings, 화면은 ProviderGrid와 PurposeRow.
 */

import { AI_PURPOSES } from '@/lib/ai/registry';
import { useT } from '@/lib/i18n/useT';
import { useAiSettings, draftFromAssignment } from './parts/useAiSettings';
import ProviderGrid from './parts/ProviderGrid';
import PurposeRow from './parts/PurposeRow';

export default function AiSettingsManager() {
  const t = useT();
  const ai = useAiSettings();

  if (ai.loading) {
    return (
      <div className="admin-empty-state">
        <p>{t('admin.ai.loading', '설정을 불러오는 중...')}</p>
      </div>
    );
  }

  return (
    <div className="ai-settings">
      {ai.error && <div className="admin-inline-error">{ai.error}</div>}
      {ai.notice && (
        <div className="ai-notice" role="status">
          {ai.notice}
        </div>
      )}

      <ProviderGrid
        providers={ai.providers}
        catalog={ai.catalog}
        keyInputs={ai.keyInputs}
        onKeyInput={(provider, value) =>
          ai.setKeyInputs((prev) => ({ ...prev, [provider]: value }))
        }
        baseUrlInputs={ai.baseUrlInputs}
        onBaseUrlInput={(value) => ai.setBaseUrlInputs((prev) => ({ ...prev, local: value }))}
        busy={ai.busy}
        onSave={ai.saveProvider}
        onRefresh={ai.refreshModels}
      />

      <section className="admin-form-section ai-section">
        <div className="ai-section-head">
          <h2 className="admin-form-section-title">{t('admin.ai.step2', '2. 용도별 모델 지정')}</h2>
          <p className="admin-form-help">
            {t(
              'admin.ai.step2Help',
              '사이트의 각 AI 기능(용도)이 어떤 제공자·모델을 쓸지 지정합니다. 용도를 지정하지 않으면 "일반 질의 (기본)" 지정으로 폴백합니다. 브랜드·버전별 파라미터 차이는 모델 이름으로 자동 판별하며, 예외는 각 행의 고급 오버라이드로 바로잡을 수 있습니다.'
            )}
          </p>
        </div>

        <div className="ai-purpose-cols" aria-hidden="true">
          <span>{t('admin.ai.colPurpose', '용도')}</span>
          <span>{t('admin.ai.colProvider', '제공자')}</span>
          <span>{t('admin.ai.colModel', '모델')}</span>
          <span />
        </div>

        {AI_PURPOSES.map((purpose) => (
          <PurposeRow
            key={purpose.key}
            purpose={purpose}
            draft={ai.drafts[purpose.key] ?? draftFromAssignment()}
            catalog={ai.catalog}
            enabledProviders={ai.enabledProviders}
            useCustomModel={Boolean(ai.customModel[purpose.key])}
            onCustomModel={(v) => ai.setCustomModel((prev) => ({ ...prev, [purpose.key]: v }))}
            onDraft={(patch) => ai.setDraft(purpose.key, patch)}
            test={ai.tests[purpose.key]}
            onTest={() => ai.testAssignment(purpose.key)}
          />
        ))}

        <div className="admin-domain-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={ai.busy === 'assignments'}
            onClick={ai.saveAssignments}
          >
            {ai.busy === 'assignments'
              ? t('admin.common.saving', '저장 중...')
              : t('admin.ai.saveAssignments', '용도별 지정 저장')}
          </button>
        </div>
      </section>
    </div>
  );
}
