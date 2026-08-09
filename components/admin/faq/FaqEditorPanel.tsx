'use client';

/**
 * Q&A 작성·편집 패널
 *
 * '대상'이 이 화면의 핵심이다 — 공통(모든 공연에 붙는 질문)과 특정 공연 전용을 가른다.
 * 목록에서 특정 공연을 보고 있을 때 새로 쓰면 그 공연이 기본 대상이 된다(FaqManager).
 */

import { useT } from '@/lib/i18n/useT';
import type { FaqEventOption } from './FaqManager';

export interface FaqFormState {
  /** ''=공통, 숫자 문자열=공연 id */
  event_id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
}

interface FaqEditorPanelProps {
  form: FaqFormState;
  onChange: (patch: Partial<FaqFormState>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  events: FaqEventOption[];
  isNew: boolean;
  saving: boolean;
}

export default function FaqEditorPanel({
  form,
  onChange,
  onSubmit,
  onCancel,
  events,
  isNew,
  saving,
}: FaqEditorPanelProps) {
  const t = useT();

  return (
    <form onSubmit={onSubmit} className="admin-form faq-form-panel">
      <h3 className="admin-form-section-title">
        {isNew ? t('admin.faq.newTitle', '새 Q&A 작성') : t('admin.faq.editTitle', 'Q&A 편집')}
      </h3>

      <div className="admin-form-row">
        <div className="admin-form-group">
          <label htmlFor="faq-event" className="admin-form-label">
            {t('admin.faq.target', '대상')}
          </label>
          <select
            id="faq-event"
            className="admin-form-select"
            value={form.event_id}
            onChange={(e) => onChange({ event_id: e.target.value })}
          >
            <option value="">{t('admin.faq.targetGeneralLong', '공통 (모든 공연·행사에 해당)')}</option>
            {events.map((ev) => (
              <option key={ev.id} value={String(ev.id)}>
                {ev.year} · {ev.title_ko}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-form-group">
          <label htmlFor="faq-order" className="admin-form-label">
            {t('admin.faq.sortOrder', '표시 순서 (작을수록 먼저)')}
          </label>
          <input
            type="number"
            id="faq-order"
            className="admin-form-input"
            value={form.sort_order}
            min={0}
            onChange={(e) => onChange({ sort_order: Number(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="admin-form-group">
        <label htmlFor="faq-question" className="admin-form-label">
          {t('admin.faq.question', '질문')} <span className="required">*</span>
        </label>
        <input
          type="text"
          id="faq-question"
          className="admin-form-input"
          value={form.question}
          onChange={(e) => onChange({ question: e.target.value })}
          placeholder={t('admin.faq.questionPlaceholder', '예: 공연 당일 몇 시까지 도착해야 하나요?')}
          required
        />
      </div>

      <div className="admin-form-group">
        <label htmlFor="faq-answer" className="admin-form-label">
          {t('admin.faq.answer', '답변')} <span className="required">*</span>
        </label>
        <textarea
          id="faq-answer"
          className="admin-form-textarea"
          rows={5}
          value={form.answer}
          onChange={(e) => onChange({ answer: e.target.value })}
          required
        />
      </div>

      <div className="admin-form-checkbox">
        <input
          type="checkbox"
          id="faq-published"
          checked={form.is_published}
          onChange={(e) => onChange({ is_published: e.target.checked })}
        />
        <label htmlFor="faq-published">{t('admin.faq.publishLabel', 'Q&A 메뉴에 공개')}</label>
      </div>

      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={onCancel}
          disabled={saving}
        >
          {t('admin.common.cancel', '취소')}
        </button>
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
          {saving
            ? t('admin.common.saving', '저장 중...')
            : isNew
              ? t('admin.faq.create', '등록')
              : t('admin.common.save', '저장')}
        </button>
      </div>
    </form>
  );
}
