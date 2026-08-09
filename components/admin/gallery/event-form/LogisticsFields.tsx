'use client';

/**
 * 실행 정보 — 어디서(장소), 언제(집합·시작·종료), 무엇을 챙기나(준비물)
 *
 * 멤버가 공연 상세에서 가장 먼저 찾는 값들이라 한 묶음으로 둔다.
 * 준비물은 두 갈래다: 자유 텍스트 안내와, 카탈로그에서 골라 붙이는 목록(사진·발음 포함).
 */

import LocationPicker from '../LocationPicker';
import SupplyPicker, { type PickerRow } from '@/components/admin/supplies/SupplyPicker';
import SetPicker, { type SetPickerRow } from '@/components/admin/supplies/SetPicker';
import type { SupplyItem, SupplySetWithItems } from '@/types/supplies';
import { useT } from '@/lib/i18n/useT';
import type { FieldGroupProps, FormPatchHandler } from './types';

interface LogisticsFieldsProps extends FieldGroupProps {
  onPatch: FormPatchHandler;
  activeSupplies: SupplyItem[];
  supplies: PickerRow[];
  onSuppliesChange: (rows: PickerRow[]) => void;
  activeSupplySets: SupplySetWithItems[];
  supplySets: SetPickerRow[];
  onSupplySetsChange: (rows: SetPickerRow[]) => void;
}

export default function LogisticsFields({
  formData,
  onChange,
  onPatch,
  activeSupplies,
  supplies,
  onSuppliesChange,
  activeSupplySets,
  supplySets,
  onSupplySetsChange,
}: LogisticsFieldsProps) {
  const t = useT();

  return (
    <>
      <LocationPicker
        value={{
          location: formData.location,
          location_address: formData.location_address,
          location_lat: formData.location_lat,
          location_lng: formData.location_lng,
          location_url: formData.location_url,
        }}
        onChange={onPatch}
      />

      <div className="admin-form-row">
        <div className="admin-form-group">
          <label htmlFor="call_time" className="admin-form-label">
            {t('admin.events.fieldCallTime', '집합 시간')}
          </label>
          <input
            type="time"
            id="call_time"
            name="call_time"
            value={formData.call_time}
            onChange={onChange}
            className="admin-form-input"
          />
        </div>
        <div className="admin-form-group">
          <label htmlFor="start_time" className="admin-form-label">
            {t('admin.programs.fieldStartTime', '시작 시간')}
          </label>
          <input
            type="time"
            id="start_time"
            name="start_time"
            value={formData.start_time}
            onChange={onChange}
            className="admin-form-input"
          />
        </div>
        <div className="admin-form-group">
          <label htmlFor="end_time" className="admin-form-label">
            {t('admin.programs.fieldEndTime', '종료 시간')}
          </label>
          <input
            type="time"
            id="end_time"
            name="end_time"
            value={formData.end_time}
            onChange={onChange}
            className="admin-form-input"
          />
        </div>
      </div>

      <div className="admin-form-group">
        <label htmlFor="prep_notes" className="admin-form-label">
          {t('admin.events.fieldPrepNotes', '준비물 · 복장 · 안내')}
        </label>
        <textarea
          id="prep_notes"
          name="prep_notes"
          value={formData.prep_notes}
          onChange={onChange}
          rows={3}
          placeholder={t(
            'admin.events.prepPlaceholder',
            '예: 검정 치마저고리 지참, 머리끈, 도시락. 주차는 건물 뒤편.'
          )}
          className="admin-form-textarea"
        />
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label">{t('admin.events.supplyList', '준비물 목록')}</label>
        <p className="admin-form-help">
          {t(
            'admin.events.supplyHelp',
            '카탈로그에서 준비물을 골라 붙이면, 참가자가 사진·발음과 함께 ‘무엇을 챙길지’ 확인합니다. 위 자유 안내와 함께 표시됩니다.'
          )}
        </p>
        <SupplyPicker items={activeSupplies} value={supplies} onChange={onSuppliesChange} />
        <div className="supply-picker-setblock">
          <span className="admin-form-label">{t('admin.programs.supplySets', '세트')}</span>
          <SetPicker sets={activeSupplySets} value={supplySets} onChange={onSupplySetsChange} />
        </div>
      </div>
    </>
  );
}
