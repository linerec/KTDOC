'use client';

/**
 * SupplyForm
 * 준비물 카탈로그 항목 생성/편집 폼. 사진 업로드 + 말모이 용어 연결.
 */

import { useState, useRef } from 'react';
import { useT } from '@/lib/i18n/useT';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type {
  SupplyItemWithTerm,
  CreateSupplyItemInput,
  UpdateSupplyItemInput,
} from '@/types/supplies';
import type { GlossaryTermWithCategory } from '@/types/glossary';
import { uploadImageFile } from '@/lib/uploadClient';

interface SupplyFormProps {
  item?: SupplyItemWithTerm | null;
  terms: GlossaryTermWithCategory[];
  isNew?: boolean;
}

export default function SupplyForm({ item, terms, isNew = false }: SupplyFormProps) {
  const t = useT();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name_ko: item?.name_ko || '',
    name_en: item?.name_en || '',
    description_ko: item?.description_ko || '',
    description_en: item?.description_en || '',
    image_url: item?.image_url || '',
    image_r2_key: item?.image_r2_key || '',
    glossary_term_id: item?.glossary_term_id ? String(item.glossary_term_id) : '',
    is_active: item ? item.is_active === 1 : true,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadImageFile<{
        success: boolean;
        data: { url: string; key: string };
      }>('/api/admin/supplies/upload', file);
      setFormData((prev) => ({ ...prev, image_url: res.data.url, image_r2_key: res.data.key }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.uploadFailed', '업로드에 실패했습니다.')
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeImage = () => setFormData((prev) => ({ ...prev, image_url: '', image_r2_key: '' }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name_ko.trim()) {
      setError(t('admin.supplies.nameRequired', '준비물 이름(한글)은 필수입니다.'));
      return;
    }

    setSaving(true);
    try {
      const url = isNew ? '/api/admin/supplies' : `/api/admin/supplies/${item?.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const body: CreateSupplyItemInput | UpdateSupplyItemInput = {
        name_ko: formData.name_ko.trim(),
        name_en: formData.name_en || undefined,
        description_ko: formData.description_ko || undefined,
        description_en: formData.description_en || undefined,
        image_url: formData.image_url || null,
        image_r2_key: formData.image_r2_key || null,
        glossary_term_id: formData.glossary_term_id ? parseInt(formData.glossary_term_id) : null,
        is_active: formData.is_active,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.saveFailed', '저장에 실패했습니다.'));
      }

      router.push('/admin/supplies');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.saveFailed', '저장에 실패했습니다.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <div className="admin-form-grid">
        {/* 기본 정보 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">{t('admin.supplies.info', '준비물 정보')}</h3>
          <p className="admin-form-help">
            {t(
              'admin.supplies.infoHelp',
              '한 번 등록하면 여러 공연·수업에서 재사용합니다. 공연별 수량·비고는 각 공연 편집에서 정합니다.'
            )}
          </p>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="name_ko" className="admin-form-label">
                {t('admin.supplies.nameKo', '이름 (한글)')} <span className="required">*</span>
              </label>
              <input
                type="text"
                id="name_ko"
                name="name_ko"
                value={formData.name_ko}
                onChange={handleChange}
                required
                className="admin-form-input"
                placeholder={t('admin.supplies.namePlaceholder', '한복')}
              />
            </div>
            <div className="admin-form-group">
              <label htmlFor="name_en" className="admin-form-label">
                {t('admin.supplies.nameEn', '이름 (영문)')}
              </label>
              <input
                type="text"
                id="name_en"
                name="name_en"
                value={formData.name_en}
                onChange={handleChange}
                className="admin-form-input"
                placeholder="Hanbok (Korean dress)"
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="description_ko" className="admin-form-label">
              {t('admin.supplies.descKo', '설명 (한글)')}
            </label>
            <textarea
              id="description_ko"
              name="description_ko"
              value={formData.description_ko}
              onChange={handleChange}
              rows={2}
              className="admin-form-textarea"
              placeholder={t('admin.supplies.descPlaceholder', '무엇인지, 어디서 준비하는지 안내하세요.')}
            />
          </div>
          <div className="admin-form-group">
            <label htmlFor="description_en" className="admin-form-label">
              {t('admin.supplies.descEn', '설명 (영문)')}
            </label>
            <textarea
              id="description_en"
              name="description_en"
              value={formData.description_en}
              onChange={handleChange}
              rows={2}
              className="admin-form-textarea"
            />
          </div>
        </div>

        {/* 사진 + 말모이 연결 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">{t('admin.supplies.photoLink', '사진 · 연결')}</h3>

          <div className="admin-form-group">
            <label className="admin-form-label">{t('admin.supplies.photo', '사진 / 아이콘')}</label>
            <div className="supply-image-upload">
              {formData.image_url ? (
                <div className="supply-image-preview">
                  <Image src={formData.image_url} alt="" width={96} height={96} className="supply-image-thumb" />
                  <button type="button" className="admin-btn admin-btn-sm admin-btn-danger" onClick={removeImage}>
                    {t('admin.supplies.removePhoto', '사진 제거')}
                  </button>
                </div>
              ) : (
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="admin-form-input"
                />
              )}
              {uploading ? (
                <p className="admin-form-help">{t('admin.photos.uploadingShort', '업로드 중...')}</p>
              ) : (
                !formData.image_url && <p className="admin-form-help">{t('admin.supplies.imageLimit', '4MB 이하의 이미지 파일.')}</p>
              )}
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="glossary_term_id" className="admin-form-label">
              {t('admin.supplies.glossaryLink', '말모이 용어 연결')}
            </label>
            <select
              id="glossary_term_id"
              name="glossary_term_id"
              value={formData.glossary_term_id}
              onChange={handleChange}
              className="admin-form-select"
            >
              <option value="">{t('admin.supplies.noLink', '연결 안 함')}</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.term_ko}
                  {t.pronunciation ? ` (${t.pronunciation})` : ''}
                </option>
              ))}
            </select>
            <p className="admin-form-help">
              {t(
                'admin.supplies.glossaryHelp',
                '연결하면 학생·학부모가 준비물에서 바로 이 용어의 발음·뜻을 볼 수 있습니다.'
              )}
            </p>
          </div>

          <div className="admin-form-checkbox">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
            />
            <label htmlFor="is_active">
              {t('admin.supplies.activeLabel', '활성 (공연·수업에서 선택 가능)')}
            </label>
          </div>
        </div>
      </div>

      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => router.push('/admin/supplies')}
          disabled={saving}
        >
          {t('admin.common.cancel', '취소')}
        </button>
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || uploading}>
          {saving
            ? t('admin.common.saving', '저장 중...')
            : isNew
              ? t('admin.common.create', '생성')
              : t('admin.common.save', '저장')}
        </button>
      </div>
    </form>
  );
}
