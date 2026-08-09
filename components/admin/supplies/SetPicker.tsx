'use client';

/**
 * SetPicker
 * 공연/수업 편집에서 준비물 '세트'를 골라 붙이는 선택기(SupplyPicker의 세트판).
 * 세트를 고르면 그 안의 항목이 함께 표시된다. 값은 상위 폼이 state로 보관한다.
 */

import { useMemo } from 'react';
import T from '@/components/common/T';
import { useT } from '@/lib/i18n/useT';
import type { SupplySetWithItems, SupplySetLinkInput } from '@/types/supplies';

export interface SetPickerRow extends SupplySetLinkInput {
  is_required: boolean;
}

interface Props {
  sets: SupplySetWithItems[];
  value: SetPickerRow[];
  onChange: (rows: SetPickerRow[]) => void;
}

export default function SetPicker({ sets, value, onChange }: Props) {
  const t = useT();
  const setById = useMemo(() => new Map(sets.map((s) => [s.id, s])), [sets]);
  const selectedIds = new Set(value.map((r) => r.supply_set_id));
  const available = sets.filter((s) => !selectedIds.has(s.id));

  const addSet = (id: number) => {
    if (!id || selectedIds.has(id)) return;
    onChange([...value, { supply_set_id: id, quantity: '', note_ko: '', note_en: '', is_required: true }]);
  };

  const updateRow = (id: number, patch: Partial<SetPickerRow>) => {
    onChange(value.map((r) => (r.supply_set_id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: number) => {
    onChange(value.filter((r) => r.supply_set_id !== id));
  };

  if (sets.length === 0) {
    return (
      <p className="admin-form-help">
        <T
          k="admin.sets.emptyHint"
          params={{
            link: (
              <a href="/admin/supplies/sets" target="_blank">
                {t('admin.sets.catalog', '준비물 세트')}
              </a>
            ),
          }}
        >
          {'만든 세트가 없습니다. {link}에서 먼저 세트를 만드세요.'}
        </T>
      </p>
    );
  }

  return (
    <div className="supply-picker">
      {value.length > 0 && (
        <ul className="supply-picker-list">
          {value.map((row) => {
            const set = setById.get(row.supply_set_id);
            if (!set) return null;
            return (
              <li key={row.supply_set_id} className="supply-picker-row">
                <div className="supply-picker-name">
                  <strong>📦 {set.name_ko}</strong>
                  {set.name_en && <span className="supply-picker-name-en">{set.name_en}</span>}
                </div>
                <p className="set-picker-members">
                  {set.items.map((i) => i.name_ko).join(', ') ||
                    t('admin.sets.noItems', '구성 없음')}
                </p>
                <div className="supply-picker-fields">
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder={t('admin.sets.qtyPlaceholder', '수량/비고 (선택)')}
                    value={row.quantity || ''}
                    onChange={(e) => updateRow(row.supply_set_id, { quantity: e.target.value })}
                  />
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder={t('admin.supplies.notePlaceholder', '추가 안내 (한글, 선택)')}
                    value={row.note_ko || ''}
                    onChange={(e) => updateRow(row.supply_set_id, { note_ko: e.target.value })}
                  />
                  <label className="supply-picker-req">
                    <input
                      type="checkbox"
                      checked={row.is_required}
                      onChange={(e) => updateRow(row.supply_set_id, { is_required: e.target.checked })}
                    />
                    {t('admin.supplies.required', '필수')}
                  </label>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    onClick={() => removeRow(row.supply_set_id)}
                  >
                    {t('admin.supplies.remove', '제거')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {available.length > 0 && (
        <div className="supply-picker-add">
          <select
            className="admin-form-select"
            value=""
            onChange={(e) => {
              const id = parseInt(e.target.value);
              if (id) addSet(id);
            }}
          >
            <option value="">{t('admin.sets.addSet', '+ 세트 추가...')}</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ko} {t('admin.sets.itemCount', '({n}개)', { n: s.items.length })}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
