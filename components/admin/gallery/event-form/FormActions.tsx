'use client';

/**
 * 폼 하단 버튼 — 취소 / (비공개일 때) 저장 및 공개 / 저장
 *
 * '저장 및 공개'도 submit 버튼이다. 네이티브 필수값 검증을 그대로 태우기 위해서이고,
 * 어느 버튼을 눌렀는지는 클릭 시 세우는 의도 플래그(setPublishIntent)로 구분한다.
 * 편집은 저장해도 화면이 그대로라 결과를 버튼 옆에 글로 남긴다.
 */

import { useT } from '@/lib/i18n/useT';

interface FormActionsProps {
  isNew: boolean;
  isPublished: boolean;
  saving: boolean;
  publishSaving: boolean;
  saved: boolean;
  savedMsg: string;
  error: string | null;
  onCancel: () => void;
  onSetPublishIntent: (v: boolean) => void;
}

export default function FormActions({
  isNew,
  isPublished,
  saving,
  publishSaving,
  saved,
  savedMsg,
  error,
  onCancel,
  onSetPublishIntent,
}: FormActionsProps) {
  const t = useT();

  return (
    <div className="admin-form-actions">
      {savedMsg && (
        <span className="admin-form-saved" role="status">
          ✓ {savedMsg}
        </span>
      )}
      {error && (
        <span className="admin-form-saved admin-form-saved--error" role="alert">
          {error}
        </span>
      )}
      <button
        type="button"
        className="admin-btn admin-btn-outline"
        onClick={onCancel}
        disabled={saving}
      >
        {t('admin.common.cancel', '취소')}
      </button>

      {/* 비공개(또는 신규) 상태에서만: 공개 전환과 저장을 한 번에 */}
      {!isPublished && (
        <button
          type="submit"
          className="admin-btn admin-btn-gold"
          disabled={saving}
          onClick={() => onSetPublishIntent(true)}
          title={t(
            'admin.events.publishTitle',
            '공개 상태로 저장합니다 — 공개 Gallery에 바로 표시됩니다'
          )}
        >
          {saving && publishSaving
            ? t('admin.common.saving', '저장 중...')
            : isNew
              ? t('admin.events.createAndPublish', '생성 및 공개')
              : t('admin.events.saveAndPublish', '저장 및 공개')}
        </button>
      )}

      <button
        type="submit"
        className={`admin-btn ${saved ? 'admin-btn-gold' : 'admin-btn-primary'}`}
        disabled={saving}
        onClick={() => onSetPublishIntent(false)}
      >
        {saving && !publishSaving
          ? t('admin.common.saving', '저장 중...')
          : saved
            ? t('admin.common.savedMark', '저장됨 ✓')
            : isNew
              ? t('admin.common.create', '생성')
              : t('admin.common.save', '저장')}
      </button>
    </div>
  );
}
