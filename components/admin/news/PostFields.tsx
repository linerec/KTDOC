'use client';

/**
 * 게시물 기본 정보 — 분류·게시일·제목·본문
 *
 * 분류에 따라 필요한 칸이 달라진다: 언론보도는 출처와 기사 링크, 영상은 YouTube 링크.
 * 해당 없는 칸을 숨기는 것은 의도다 — 빈 칸이 많으면 무엇을 채워야 하는지 흐려진다.
 */

import type { ChangeEvent } from 'react';
import type { NewsCategory } from '@/types/news';
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABELS } from '@/types/news';
import { useT } from '@/lib/i18n/useT';

export interface NewsFormData {
  category: NewsCategory;
  title_ko: string;
  title_en: string;
  published_at: string;
  source_name: string;
  external_url: string;
  youtube_url: string;
  body_ko: string;
  body_en: string;
  thumbnail_url: string;
  thumbnail_r2_key: string;
  is_published: boolean;
}

interface PostFieldsProps {
  formData: NewsFormData;
  onChange: (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => void;
}

export default function PostFields({ formData, onChange }: PostFieldsProps) {
  const t = useT();

  return (
    <div className="admin-form-section">
      <h3 className="admin-form-section-title">{t('admin.news.secBasic', '게시물 기본 정보')}</h3>
      <p className="admin-form-help">
        {t(
          'admin.news.secBasicHelp',
          '이 정보가 공개 미디어 페이지(/media)의 카드와 상세 화면에 표시됩니다.'
        )}
      </p>

      <div className="admin-form-row">
        <div className="admin-form-group">
          <label htmlFor="category" className="admin-form-label">
            {t('admin.news.fieldCategory', '분류')} <span className="required">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={onChange}
            className="admin-form-select"
          >
            {NEWS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`admin.news.category.${c}`, NEWS_CATEGORY_LABELS[c])}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-form-group">
          <label htmlFor="published_at" className="admin-form-label">
            {t('admin.news.fieldDate', '게시일')} <span className="required">*</span>
          </label>
          <input
            type="date"
            id="published_at"
            name="published_at"
            value={formData.published_at}
            onChange={onChange}
            required
            className="admin-form-input"
          />
        </div>
      </div>

      <div className="admin-form-group">
        <label htmlFor="title_ko" className="admin-form-label">
          {t('admin.common.fieldTitleKo', '제목 (한글)')} <span className="required">*</span>
        </label>
        <input
          type="text"
          id="title_ko"
          name="title_ko"
          value={formData.title_ko}
          onChange={onChange}
          required
          className="admin-form-input"
        />
      </div>

      <div className="admin-form-group">
        <label htmlFor="title_en" className="admin-form-label">
          {t('admin.common.fieldTitleEn', '제목 (영문)')}
        </label>
        <input
          type="text"
          id="title_en"
          name="title_en"
          value={formData.title_en}
          onChange={onChange}
          className="admin-form-input"
        />
      </div>

      {formData.category === 'press' && (
        <div className="admin-form-row">
          <div className="admin-form-group">
            <label htmlFor="source_name" className="admin-form-label">
              {t('admin.news.fieldSource', '출처 (매체명)')}
            </label>
            <input
              type="text"
              id="source_name"
              name="source_name"
              value={formData.source_name}
              onChange={onChange}
              placeholder={t('admin.news.sourcePlaceholder', '예: 중앙일보')}
              className="admin-form-input"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="external_url" className="admin-form-label">
              {t('admin.news.fieldExternalUrl', '기사 원문 링크')}
            </label>
            <input
              type="url"
              id="external_url"
              name="external_url"
              value={formData.external_url}
              onChange={onChange}
              placeholder="https://..."
              className="admin-form-input"
            />
          </div>
        </div>
      )}

      {formData.category === 'video' && (
        <div className="admin-form-group">
          <label htmlFor="youtube_url" className="admin-form-label">
            {t('admin.news.fieldYoutube', 'YouTube 링크')} <span className="required">*</span>
          </label>
          <input
            type="url"
            id="youtube_url"
            name="youtube_url"
            value={formData.youtube_url}
            onChange={onChange}
            placeholder="https://www.youtube.com/watch?v=..."
            className="admin-form-input"
          />
          <p className="admin-form-help">
            {t(
              'admin.news.youtubeHelp',
              '상세 화면에 영상이 임베드됩니다. 대표 이미지가 없으면 YouTube 썸네일이 사용됩니다.'
            )}
          </p>
        </div>
      )}

      <div className="admin-form-group">
        <label htmlFor="body_ko" className="admin-form-label">
          {t('admin.news.fieldBodyKo', '본문 (한글)')}
        </label>
        <textarea
          id="body_ko"
          name="body_ko"
          value={formData.body_ko}
          onChange={onChange}
          rows={8}
          className="admin-form-textarea"
        />
      </div>

      <div className="admin-form-group">
        <label htmlFor="body_en" className="admin-form-label">
          {t('admin.news.fieldBodyEn', '본문 (영문)')}
        </label>
        <textarea
          id="body_en"
          name="body_en"
          value={formData.body_en}
          onChange={onChange}
          rows={8}
          className="admin-form-textarea"
        />
      </div>
    </div>
  );
}
