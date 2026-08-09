'use client';

/**
 * 미리보기 · 저장
 *
 * 지금 입력값이 검색엔진에 어떤 등급으로 올라가는지(LocalBusiness / Organization)를
 * 저장 전에 알려 준다 — 주소 4개를 채우는 일이 왜 중요한지 여기서 드러난다.
 */

import type { SeoBusinessInfo } from '@/lib/seoBusiness';
import { formatAddressLine, hasFullAddress } from '@/lib/seoBusiness';
import { useT } from '@/lib/i18n/useT';
import T from '@/components/common/T';

interface SeoPreviewSaveProps {
  draft: SeoBusinessInfo;
  jsonLdPreview: string;
  error: string;
  result: string;
  saving: boolean;
  onSave: () => void;
}

export default function SeoPreviewSave({
  draft,
  jsonLdPreview,
  error,
  result,
  saving,
  onSave,
}: SeoPreviewSaveProps) {
  const t = useT();
  const complete = hasFullAddress(draft);

  return (
    <section className="admin-form-section admin-account-card">
      <h2 className="admin-form-section-title">{t('admin.seo.previewTitle', '미리보기 · 저장')}</h2>

      <div className={`admin-cal-status${complete ? ' is-on' : ' is-off'}`}>
        <span className="admin-cal-status-dot" aria-hidden="true" />
        {complete ? (
          <span>
            <T
              k="admin.seo.statusLocal"
              params={{ kind: <strong>LocalBusiness</strong>, line: formatAddressLine(draft) }}
            >
              {'주소 완성 — 검색엔진에 {kind}(지역 업체)로 게시됩니다. 푸터 표기: {line}'}
            </T>
          </span>
        ) : (
          <span>
            <T k="admin.seo.statusOrg" params={{ kind: <strong>Organization</strong> }}>
              {'주소가 아직 완성되지 않아 {kind} 수준으로만 게시됩니다. 도로명·시·주·우편번호 4개를 채우면 지역 업체로 승격됩니다.'}
            </T>
          </span>
        )}
      </div>

      <details className="admin-seo-jsonld">
        <summary>{t('admin.seo.jsonLd', '구조화 데이터(JSON-LD) 미리보기')}</summary>
        <pre>{jsonLdPreview}</pre>
      </details>

      {error && (
        <p className="admin-account-feedback admin-account-feedback--error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <p className="admin-account-feedback admin-account-feedback--success" role="status">
          {result}
        </p>
      )}

      <div className="admin-domain-actions">
        <button type="button" className="admin-btn admin-btn-gold" onClick={onSave} disabled={saving}>
          {saving ? t('admin.common.saving', '저장 중...') : t('admin.seo.save', '사이트 정보 저장')}
        </button>
      </div>
    </section>
  );
}
