'use client';

/**
 * CategoryManager Component
 * 카테고리 관리 (CRUD)
 */

import { useState } from 'react';
import type { EventCategory, CreateCategoryInput } from '@/types/gallery';

interface CategoryManagerProps {
  initialCategories: EventCategory[];
}

export default function CategoryManager({
  initialCategories,
}: CategoryManagerProps) {
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
        throw new Error('모든 필드를 입력해주세요.');
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
          throw new Error(data.error || '생성에 실패했습니다.');
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
          throw new Error(data.error || '수정에 실패했습니다.');
        }

        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === editingId ? { ...cat, ...formData } : cat
          )
        );
      }

      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const category = categories.find((c) => c.id === id);
    if (!category) return;
    if (!confirm(`"${category.name_ko}" 카테고리를 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(
        `/api/admin/gallery/categories?id=${id}`,
        { method: 'DELETE' }
      );

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '삭제에 실패했습니다.');
      }

      setCategories((prev) => prev.filter((cat) => cat.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
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
                <div className="admin-category-form">
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    placeholder="slug"
                    className="admin-form-input admin-form-input-sm"
                  />
                  <input
                    type="text"
                    name="name_ko"
                    value={formData.name_ko}
                    onChange={handleChange}
                    placeholder="한글명"
                    className="admin-form-input admin-form-input-sm"
                  />
                  <input
                    type="text"
                    name="name_en"
                    value={formData.name_en}
                    onChange={handleChange}
                    placeholder="영문명"
                    className="admin-form-input admin-form-input-sm"
                  />
                  <input
                    type="number"
                    name="sort_order"
                    value={formData.sort_order}
                    onChange={handleChange}
                    placeholder="순서"
                    className="admin-form-input admin-form-input-sm admin-form-input-number"
                  />
                  <div className="admin-category-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-primary"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? '...' : '저장'}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      onClick={resetForm}
                      disabled={saving}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="admin-category-info">
                    <span className="admin-category-order">{category.sort_order}</span>
                    <span className="admin-category-slug">{category.slug}</span>
                    <span className="admin-category-name">{category.name_ko}</span>
                    <span className="admin-category-name-en">{category.name_en}</span>
                  </div>
                  <div className="admin-category-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      onClick={() => startEdit(category)}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => handleDelete(category.id)}
                    >
                      삭제
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
          <div className="admin-category-form">
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              placeholder="slug (예: festival)"
              className="admin-form-input admin-form-input-sm"
            />
            <input
              type="text"
              name="name_ko"
              value={formData.name_ko}
              onChange={handleChange}
              placeholder="한글명"
              className="admin-form-input admin-form-input-sm"
            />
            <input
              type="text"
              name="name_en"
              value={formData.name_en}
              onChange={handleChange}
              placeholder="영문명"
              className="admin-form-input admin-form-input-sm"
            />
            <input
              type="number"
              name="sort_order"
              value={formData.sort_order}
              onChange={handleChange}
              placeholder="순서"
              className="admin-form-input admin-form-input-sm admin-form-input-number"
            />
            <div className="admin-category-actions">
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '...' : '추가'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-sm"
                onClick={resetForm}
                disabled={saving}
              >
                취소
              </button>
            </div>
          </div>
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
          + 새 카테고리 추가
        </button>
      )}
    </div>
  );
}
