'use client';

/**
 * EventForm — 공연·학내 행사 생성/편집 폼
 *
 * 이 파일은 조립만 한다. 실제 내용은 event-form/ 아래로 갈라 두었다:
 *  - useEventForm : 폼 상태와 저장 절차(저장 → 포스터 등록 → 알림)
 *  - BasicFields / LogisticsFields / DescriptionFields / FlagFields : '기본 정보' 섹션의 필드 묶음
 *  - NotifySection / MediaSections / FormActions : 그 아래 독립 섹션들
 *
 * 필드 묶음이 하나의 admin-form-section 안에 나란히 들어가는 것은 의도다 — 코드만 갈랐고
 * 화면 구조는 그대로다.
 */

import type { EventDetail, EventCategory } from '@/types/gallery';
import type { SupplyItem, SupplySetWithItems } from '@/types/supplies';
import type { PickerRow } from '@/components/admin/supplies/SupplyPicker';
import type { SetPickerRow } from '@/components/admin/supplies/SetPicker';
import { useT } from '@/lib/i18n/useT';
import AiEventFill from './AiEventFill';
import { useEventForm } from './event-form/useEventForm';
import BasicFields from './event-form/BasicFields';
import LogisticsFields from './event-form/LogisticsFields';
import DescriptionFields from './event-form/DescriptionFields';
import FlagFields from './event-form/FlagFields';
import NotifySection from './event-form/NotifySection';
import MediaSections from './event-form/MediaSections';
import FormActions from './event-form/FormActions';

interface EventFormProps {
  event?: EventDetail | null;
  categories: EventCategory[];
  isNew?: boolean;
  activeSupplies?: SupplyItem[];
  initialSupplies?: PickerRow[];
  activeSupplySets?: SupplySetWithItems[];
  initialSupplySets?: SetPickerRow[];
}

export default function EventForm({
  event,
  categories,
  isNew = false,
  activeSupplies = [],
  initialSupplies = [],
  activeSupplySets = [],
  initialSupplySets = [],
}: EventFormProps) {
  const t = useT();
  const form = useEventForm({ event, isNew, initialSupplies, initialSupplySets });

  return (
    <form onSubmit={form.handleSubmit} className="admin-form">
      {form.error && <div className="admin-alert admin-alert-error">{form.error}</div>}

      {/* 새 공연: 포스터/텍스트로 폼을 자동으로 채우는 AI 패널 */}
      {isNew && (
        <AiEventFill
          categories={categories}
          onApply={form.applyAiExtract}
          onPosterChange={(file, attach) => form.setPoster({ file, attach })}
        />
      )}
      {form.aiNote && (
        <div className="admin-alert ai-fill-note" role="status">
          {form.aiNote}
        </div>
      )}

      <div className="admin-form-grid">
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">
            {t('admin.programs.secBasic', '기본 정보')}
          </h3>
          <p className="admin-form-help">
            {t('admin.events.basicHelp', '이 정보가 공개 Gallery의 카드와 상세 페이지에 표시됩니다.')}
          </p>

          <BasicFields
            formData={form.formData}
            onChange={form.handleChange}
            categories={categories}
          />

          <LogisticsFields
            formData={form.formData}
            onChange={form.handleChange}
            onPatch={form.patchForm}
            activeSupplies={activeSupplies}
            supplies={form.supplies}
            onSuppliesChange={form.setSupplies}
            activeSupplySets={activeSupplySets}
            supplySets={form.supplySets}
            onSupplySetsChange={form.setSupplySets}
          />

          <DescriptionFields formData={form.formData} onChange={form.handleChange} />

          <FlagFields formData={form.formData} onChange={form.handleChange} />
        </div>

        <NotifySection
          formData={form.formData}
          isNew={isNew}
          notify={form.notify}
          onNotifyChange={form.setNotify}
          notifyTarget={form.notifyTarget}
          onTargetChange={form.setNotifyTarget}
          notifyRoles={form.notifyRoles}
          onToggleRole={form.toggleNotifyRole}
        />

        {!isNew && event && (
          <MediaSections
            eventId={event.id}
            images={form.images}
            onImagesChange={form.setImages}
            videos={form.videos}
            onVideosChange={form.setVideos}
          />
        )}
      </div>

      <FormActions
        isNew={isNew}
        isPublished={form.formData.is_published}
        saving={form.saving}
        publishSaving={form.publishSaving}
        saved={form.saved}
        savedMsg={form.savedMsg}
        error={form.error}
        onCancel={form.goBack}
        onSetPublishIntent={form.setPublishIntent}
      />
    </form>
  );
}
