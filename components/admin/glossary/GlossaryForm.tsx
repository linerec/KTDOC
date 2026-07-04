'use client';

/**
 * GlossaryForm
 * 말모이(용어집) 용어 생성/편집 폼 (programs ProgramForm 패턴).
 * 발음은 두 층으로 입력한다: 로마자 표기(검색·표준) + 읽기 발음 가이드(아이 발화).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  GlossaryTermWithCategory,
  CreateGlossaryTermInput,
  UpdateGlossaryTermInput,
  GlossaryCategoryWithCount,
} from '@/types/glossary';

interface GlossaryFormProps {
  term?: GlossaryTermWithCategory | null;
  categories: GlossaryCategoryWithCount[];
  isNew?: boolean;
}

export default function GlossaryForm({ term, categories, isNew = false }: GlossaryFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    term_ko: term?.term_ko || '',
    term_en: term?.term_en || '',
    romanization: term?.romanization || '',
    pronunciation: term?.pronunciation || '',
    definition_ko: term?.definition_ko || '',
    definition_en: term?.definition_en || '',
    example_ko: term?.example_ko || '',
    example_en: term?.example_en || '',
    category_id: term?.category_id ? String(term.category_id) : '',
    is_published: term ? term.is_published === 1 : true,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.term_ko.trim()) {
      setError('용어(한글)는 필수입니다.');
      return;
    }

    setSaving(true);
    try {
      const url = isNew ? '/api/admin/glossary' : `/api/admin/glossary/${term?.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const body: CreateGlossaryTermInput | UpdateGlossaryTermInput = {
        term_ko: formData.term_ko.trim(),
        term_en: formData.term_en || undefined,
        romanization: formData.romanization || undefined,
        pronunciation: formData.pronunciation || undefined,
        definition_ko: formData.definition_ko || undefined,
        definition_en: formData.definition_en || undefined,
        example_ko: formData.example_ko || undefined,
        example_en: formData.example_en || undefined,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        is_published: formData.is_published,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '저장에 실패했습니다.');
      }

      router.push('/admin/glossary');
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
        {/* 용어 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">용어</h3>
          <p className="admin-form-help">
            한글 용어와 영문 의미를 입력하세요. 로마자 표기는 검색·표준용, 발음 가이드는 아이들이 실제로 읽는 방식입니다.
          </p>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="term_ko" className="admin-form-label">
                용어 (한글) <span className="required">*</span>
              </label>
              <input
                type="text"
                id="term_ko"
                name="term_ko"
                value={formData.term_ko}
                onChange={handleChange}
                required
                className="admin-form-input"
                placeholder="춤사위"
              />
            </div>
            <div className="admin-form-group">
              <label htmlFor="term_en" className="admin-form-label">의미 (영문)</label>
              <input
                type="text"
                id="term_en"
                name="term_en"
                value={formData.term_en}
                onChange={handleChange}
                className="admin-form-input"
                placeholder="Dance Movement"
              />
            </div>
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="romanization" className="admin-form-label">로마자 표기</label>
              <input
                type="text"
                id="romanization"
                name="romanization"
                value={formData.romanization}
                onChange={handleChange}
                className="admin-form-input"
                placeholder="chumsawi"
              />
            </div>
            <div className="admin-form-group">
              <label htmlFor="pronunciation" className="admin-form-label">발음 가이드 (읽는 법)</label>
              <input
                type="text"
                id="pronunciation"
                name="pronunciation"
                value={formData.pronunciation}
                onChange={handleChange}
                className="admin-form-input"
                placeholder="choom-sah-wee"
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="category_id" className="admin-form-label">분류</label>
            <select
              id="category_id"
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              className="admin-form-select"
            >
              <option value="">분류 없음</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ko}
                  {c.name_en ? ` · ${c.name_en}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 뜻 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">뜻 · 설명</h3>
          <div className="admin-form-group">
            <label htmlFor="definition_ko" className="admin-form-label">뜻 (한글)</label>
            <textarea
              id="definition_ko"
              name="definition_ko"
              value={formData.definition_ko}
              onChange={handleChange}
              rows={3}
              className="admin-form-textarea"
              placeholder="손과 팔, 몸의 움직임으로 감정을 표현하는 전통무용의 기본 동작."
            />
          </div>
          <div className="admin-form-group">
            <label htmlFor="definition_en" className="admin-form-label">뜻 (영문)</label>
            <textarea
              id="definition_en"
              name="definition_en"
              value={formData.definition_en}
              onChange={handleChange}
              rows={3}
              className="admin-form-textarea"
              placeholder="The basic movements of hands, arms, and body that express emotion in traditional dance."
            />
          </div>
        </div>

        {/* 예문 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">예문 · 용례 (선택)</h3>
          <p className="admin-form-help">이 용어가 실제로 어떻게 쓰이는지 짧은 문장으로 보여주면 이해에 도움이 됩니다.</p>
          <div className="admin-form-group">
            <label htmlFor="example_ko" className="admin-form-label">예문 (한글)</label>
            <input
              type="text"
              id="example_ko"
              name="example_ko"
              value={formData.example_ko}
              onChange={handleChange}
              className="admin-form-input"
              placeholder="선생님이 춤사위를 하나씩 보여주셨다."
            />
          </div>
          <div className="admin-form-group">
            <label htmlFor="example_en" className="admin-form-label">예문 (영문)</label>
            <input
              type="text"
              id="example_en"
              name="example_en"
              value={formData.example_en}
              onChange={handleChange}
              className="admin-form-input"
              placeholder="The teacher showed us each chumsawi one by one."
            />
          </div>
        </div>

        {/* 공개 설정 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">공개 설정</h3>
          <div className="admin-form-checkbox">
            <input
              type="checkbox"
              id="is_published"
              name="is_published"
              checked={formData.is_published}
              onChange={handleChange}
            />
            <label htmlFor="is_published">공개 (체크하면 말모이 페이지에 표시됩니다)</label>
          </div>
        </div>
      </div>

      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => router.push('/admin/glossary')}
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
