'use client';

/**
 * SupplyPicker
 * 공연/수업 편집에서 카탈로그의 준비물을 골라 붙이는 선택기.
 * 선택된 항목마다 수량·비고·필수여부를 지정한다. 값은 상위 폼이 state로 보관한다.
 */

import { useMemo } from 'react';
import type { SupplyItem, SupplyLinkInput } from '@/types/supplies';

export interface PickerRow extends SupplyLinkInput {
  is_required: boolean;
}

interface Props {
  items: SupplyItem[];
  value: PickerRow[];
  onChange: (rows: PickerRow[]) => void;
}

export default function SupplyPicker({ items, value, onChange }: Props) {
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const selectedIds = new Set(value.map((r) => r.supply_item_id));
  const available = items.filter((i) => !selectedIds.has(i.id));

  const addItem = (id: number) => {
    if (!id || selectedIds.has(id)) return;
    onChange([...value, { supply_item_id: id, quantity: '', note_ko: '', note_en: '', is_required: true }]);
  };

  const updateRow = (id: number, patch: Partial<PickerRow>) => {
    onChange(value.map((r) => (r.supply_item_id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: number) => {
    onChange(value.filter((r) => r.supply_item_id !== id));
  };

  if (items.length === 0) {
    return (
      <p className="admin-form-help">
        등록된 준비물이 없습니다. 먼저 <a href="/admin/supplies" target="_blank">준비물 카탈로그</a>에서 항목을 추가하세요.
      </p>
    );
  }

  return (
    <div className="supply-picker">
      {value.length === 0 && <p className="admin-form-help">아래에서 준비물을 선택해 추가하세요.</p>}

      {value.length > 0 && (
        <ul className="supply-picker-list">
          {value.map((row) => {
            const item = itemById.get(row.supply_item_id);
            if (!item) return null;
            return (
              <li key={row.supply_item_id} className="supply-picker-row">
                <div className="supply-picker-name">
                  <strong>{item.name_ko}</strong>
                  {item.name_en && <span className="supply-picker-name-en">{item.name_en}</span>}
                </div>
                <div className="supply-picker-fields">
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder="수량/비고 (예: 2개)"
                    value={row.quantity || ''}
                    onChange={(e) => updateRow(row.supply_item_id, { quantity: e.target.value })}
                  />
                  <input
                    type="text"
                    className="admin-form-input"
                    placeholder="추가 안내 (한글, 선택)"
                    value={row.note_ko || ''}
                    onChange={(e) => updateRow(row.supply_item_id, { note_ko: e.target.value })}
                  />
                  <label className="supply-picker-req">
                    <input
                      type="checkbox"
                      checked={row.is_required}
                      onChange={(e) => updateRow(row.supply_item_id, { is_required: e.target.checked })}
                    />
                    필수
                  </label>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    onClick={() => removeRow(row.supply_item_id)}
                  >
                    제거
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
              if (id) addItem(id);
            }}
          >
            <option value="">+ 준비물 추가...</option>
            {available.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name_ko}
                {i.name_en ? ` · ${i.name_en}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
