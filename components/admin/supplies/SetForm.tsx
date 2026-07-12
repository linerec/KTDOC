'use client';

/**
 * SetForm
 * 준비물 세트 생성/편집 폼. 이름·설명 + 카탈로그 항목을 골라 묶는다.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  SupplySetWithItems,
  CreateSupplySetInput,
  UpdateSupplySetInput,
  SupplyItem,
} from '@/types/supplies';

interface SetFormProps {
  set?: SupplySetWithItems | null;
  items: SupplyItem[];
  isNew?: boolean;
}

export default function SetForm({ set, items, isNew = false }: SetFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name_ko: set?.name_ko || '',
    name_en: set?.name_en || '',
    description_ko: set?.description_ko || '',
    description_en: set?.description_en || '',
    is_active: set ? set.is_active === 1 : true,
  });
  const [selected, setSelected] = useState<number[]>(
    set?.items?.map((i) => i.supply_item_id) || []
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const toggleItem = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name_ko.trim()) {
      setError('세트 이름(한글)은 필수입니다.');
      return;
    }
    if (selected.length === 0) {
      setError('세트에 포함할 준비물을 하나 이상 선택하세요.');
      return;
    }

    setSaving(true);
    try {
      const url = isNew ? '/api/admin/supplies/sets' : `/api/admin/supplies/sets/${set?.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const body: CreateSupplySetInput | UpdateSupplySetInput = {
        name_ko: formData.name_ko.trim(),
        name_en: formData.name_en || undefined,
        description_ko: formData.description_ko || undefined,
        description_en: formData.description_en || undefined,
        is_active: formData.is_active,
        item_ids: selected,
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '저장에 실패했습니다.');
      router.push('/admin/supplies/sets');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <div className="admin-form-grid">
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">세트 정보</h3>
          <p className="admin-form-help">
            자주 함께 챙기는 준비물을 하나의 세트로 묶습니다. 공연·수업에서는 개별 항목과 세트를 섞어 지정할 수 있습니다.
          </p>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="name_ko" className="admin-form-label">
                세트 이름 (한글) <span className="required">*</span>
              </label>
              <input
                type="text"
                id="name_ko"
                name="name_ko"
                value={formData.name_ko}
                onChange={handleChange}
                required
                className="admin-form-input"
                placeholder="공연 기본 세트"
              />
            </div>
            <div className="admin-form-group">
              <label htmlFor="name_en" className="admin-form-label">세트 이름 (영문)</label>
              <input
                type="text"
                id="name_en"
                name="name_en"
                value={formData.name_en}
                onChange={handleChange}
                className="admin-form-input"
                placeholder="Performance Basics"
              />
            </div>
          </div>
          <div className="admin-form-group">
            <label htmlFor="description_ko" className="admin-form-label">설명 (한글)</label>
            <textarea
              id="description_ko"
              name="description_ko"
              value={formData.description_ko}
              onChange={handleChange}
              rows={2}
              className="admin-form-textarea"
              placeholder="어떤 자리에 챙기는 묶음인지 안내하세요."
            />
          </div>
          <div className="admin-form-checkbox">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
            />
            <label htmlFor="is_active">활성 (공연·수업에서 선택 가능)</label>
          </div>
        </div>

        <div className="admin-form-section">
          <h3 className="admin-form-section-title">
            포함 준비물 <span className="admin-form-help" style={{ display: 'inline' }}>({selected.length}개 선택)</span>
          </h3>
          {items.length === 0 ? (
            <p className="admin-form-help">
              등록된 준비물이 없습니다. 먼저 <a href="/admin/supplies" target="_blank">준비물 카탈로그</a>에서 항목을 추가하세요.
            </p>
          ) : (
            <ul className="set-item-checklist">
              {items.map((item) => (
                <li key={item.id} className="set-item-check">
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                    <span className="set-item-check-name">
                      {item.name_ko}
                      {item.name_en && <span className="set-item-check-en">{item.name_en}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => router.push('/admin/supplies/sets')}
          disabled={saving}
        >
          취소
        </button>
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
          {saving ? '저장 중...' : isNew ? '생성' : '저장'}
        </button>
      </div>
    </form>
  );
}
