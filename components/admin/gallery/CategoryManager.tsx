'use client';

/**
 * CategoryManager Component
 * 카테고리 관리 (CRUD)
 */

import { useState } from 'react';
import type { EventCategory, CreateCategoryInput } from '@/types/gallery';
import { useT } from '@/lib/i18n/useT';
import { useLocaleText } from '@/components/common/LocaleText';
import CategoryFields from './CategoryFields';

interface CategoryManagerProps {
  initialCategories: EventCategory[];
  /** 생성·수정·삭제가 성공할 때마다 호출 — 모달에서 부모 페이지(router.refresh)에 즉시 반영하는 데 쓴다. */
  onChanged?: () => void;
}

export default function CategoryManager({
  initialCategories,
  onChanged,
}: CategoryManagerProps) {
  const t = useT();
  const pick = useLocaleText();
  const [categories, setCategories] = useState(initialCategories);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateCategoryInput>({
    slug: '',
    name_ko: '',
    name_en: '',
    sort_order: 0,
  });

  const resetForm = () => {
    setFormData({
      slug: '',
      name_ko: '',
      name_en: '',
      sort_order: categories.length,
    });
    setEditingId(null);
    setIsAdding(false);
    setError(null);
  };

  const startEdit = (category: EventCategory) => {
    setFormData({
      slug: category.slug,
      name_ko: category.name_ko,
      name_en: category.name_en,
      sort_order: category.sort_order,
    });
    setEditingId(category.id);
    setIsAdding(false);
    setError(null);
  };

  const startAdd = () => {
    resetForm();
    setFormData((prev) => ({ ...prev, sort_order: categories.length }));
    setIsAdding(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      if (!formData.slug || !formData.name_ko || !formData.name_en) {
        throw new Error(t('admin.categories.allFieldsRequired', '모든 필드를 입력해주세요.'));
      }

      if (isAdding) {
        // Create new category
        const res = await fetch('/api/admin/gallery/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || t('admin.categories.createFailed', '생성에 실패했습니다.'));
        }

        setCategories((prev) => [
          ...prev,
          {
            id: data.data.id,
            slug: formData.slug,
            name_ko: formData.name_ko,
            name_en: formData.name_en,
            sort_order: formData.sort_order ?? prev.length,
            created_at: new Date().toISOString(),
          },
        ]);
      } else if (editingId) {
        // Update existing category
        const res = await fetch('/api/admin/gallery/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...formData }),
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || t('admin.categories.updateFailed', '수정에 실패했습니다.'));
        }

        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === editingId ? { ...cat, ...formData } : cat
          )
        );
      }

      resetForm();
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.saveFailed', '저장에 실패했습니다.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const category = categories.find((c) => c.id === id);
    if (!category) return;
    if (
      !confirm(
        t('admin.categories.deleteConfirm', '"{name}" 카테고리를 삭제하시겠습니까?', {
          name: category.name_ko,
        })
      )
    )
      return;

    try {
      const res = await fetch(
        `/api/admin/gallery/categories?id=${id}`,
        { method: 'DELETE' }
      );

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.deleteFailed', '삭제에 실패했습니다.'));
      }

      setCategories((prev) => prev.filter((cat) => cat.id !== id));
      onChanged?.();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : t('admin.common.deleteFailed', '삭제에 실패했습니다.')
      );
    }
  };

  return (
    <div className="admin-category-manager">
      {/* Category List */}
      <div className="admin-category-list">
        {categories
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((category) => (
            <div
              key={category.id}
              className={`admin-category-item ${
                editingId === category.id ? 'admin-category-item-editing' : ''
              }`}
            >
              {editingId === category.id ? (
                <CategoryFields
                  value={formData}
                  onChange={handleChange}
                  onSubmit={handleSave}
                  onCancel={resetForm}
                  saving={saving}
                  submitLabel={t('admin.common.save', '저장')}
                  slugPlaceholder="slug"
                />
              ) : (
                <>
                  <div className="admin-category-info">
                    <span className="admin-category-order">{category.sort_order}</span>
                    <span className="admin-category-slug">{category.slug}</span>
                    <span className="admin-category-name">
                      {pick(category.name_ko, category.name_en)}
                    </span>
                    <span className="admin-category-name-en">{category.name_en}</span>
                  </div>
                  <div className="admin-category-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      onClick={() => startEdit(category)}
                    >
                      {t('admin.common.editShort', '수정')}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => handleDelete(category.id)}
                    >
                      {t('admin.common.delete', '삭제')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
      </div>

      {/* Add New Category */}
      {isAdding ? (
        <div className="admin-category-add">
          <CategoryFields
            value={formData}
            onChange={handleChange}
            onSubmit={handleSave}
            onCancel={resetForm}
            saving={saving}
            submitLabel={t('admin.categories.add', '추가')}
            slugPlaceholder={t('admin.categories.slugPlaceholder', 'slug (예: festival)')}
          />
          {error && (
            <div className="admin-alert admin-alert-error admin-alert-sm">
              {error}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="admin-btn admin-btn-outline admin-btn-block"
          onClick={startAdd}
        >
          {t('admin.categories.addNew', '+ 새 카테고리 추가')}
        </button>
      )}
    </div>
  );
}
