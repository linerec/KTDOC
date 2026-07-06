'use client';

/**
 * NewsForm Component
 * 뉴스·미디어 게시물 생성/편집 폼
 */

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { NewsPost, NewsCategory, CreateNewsPostInput, UpdateNewsPostInput } from '@/types/news';
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABELS } from '@/types/news';

interface NewsFormProps {
  post?: NewsPost | null;
  isNew?: boolean;
}

export default function NewsForm({ post, isNew = false }: NewsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 저장 완료 피드백(편집 시 화면 변화가 없어 명확한 신호가 필요)
  const [saved, setSaved] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    category: (post?.category || 'news') as NewsCategory,
    title_ko: post?.title_ko || '',
    title_en: post?.title_en || '',
    published_at: post?.published_at || new Date().toISOString().slice(0, 10),
    source_name: post?.source_name || '',
    external_url: post?.external_url || '',
    youtube_url: post?.youtube_url || '',
    body_ko: post?.body_ko || '',
    body_en: post?.body_en || '',
    thumbnail_url: post?.thumbnail_url || '',
    thumbnail_r2_key: post?.thumbnail_r2_key || '',
    is_published: post?.is_published === 1,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (savedMsg) setSavedMsg('');
    if (saved) setSaved(false);
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleThumbnailSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/news/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '이미지 업로드에 실패했습니다.');
      }
      setFormData((prev) => ({
        ...prev,
        thumbnail_url: data.data.url,
        thumbnail_r2_key: data.data.key,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      // 같은 파일을 다시 선택해도 change 이벤트가 발생하도록 초기화
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearThumbnail = () => {
    setFormData((prev) => ({ ...prev, thumbnail_url: '', thumbnail_r2_key: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg('');

    if (formData.category === 'video' && !formData.youtube_url.trim()) {
      setError('영상 게시물에는 YouTube 링크가 필요합니다.');
      return;
    }

    setSaving(true);
    try {
      const url = isNew ? '/api/admin/news' : `/api/admin/news/${post?.id}`;
      const method = isNew ? 'POST' : 'PUT';

      // 빈 문자열을 보내면 서버가 null로 저장(값 지우기 지원)
      const body: CreateNewsPostInput | UpdateNewsPostInput = {
        category: formData.category,
        title_ko: formData.title_ko,
        title_en: formData.title_en,
        published_at: formData.published_at,
        source_name: formData.source_name,
        external_url: formData.external_url,
        youtube_url: formData.youtube_url,
        body_ko: formData.body_ko,
        body_en: formData.body_en,
        thumbnail_url: formData.thumbnail_url,
        thumbnail_r2_key: formData.thumbnail_r2_key,
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

      if (isNew) {
        router.push('/admin/news');
        router.refresh();
      } else {
        setSaved(true);
        setSavedMsg('저장되었습니다.');
        router.refresh();
        window.setTimeout(() => setSaved(false), 3000);
      }
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
          <h3 className="admin-form-section-title">게시물 기본 정보</h3>
          <p className="admin-form-help">
            이 정보가 공개 미디어 페이지(/media)의 카드와 상세 화면에 표시됩니다.
          </p>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="category" className="admin-form-label">
                분류 <span className="required">*</span>
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="admin-form-select"
              >
                {NEWS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{NEWS_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label htmlFor="published_at" className="admin-form-label">
                게시일 <span className="required">*</span>
              </label>
              <input
                type="date"
                id="published_at"
                name="published_at"
                value={formData.published_at}
                onChange={handleChange}
                required
                className="admin-form-input"
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="title_ko" className="admin-form-label">
              제목 (한글) <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title_ko"
              name="title_ko"
              value={formData.title_ko}
              onChange={handleChange}
              required
              className="admin-form-input"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="title_en" className="admin-form-label">
              제목 (영문)
            </label>
            <input
              type="text"
              id="title_en"
              name="title_en"
              value={formData.title_en}
              onChange={handleChange}
              className="admin-form-input"
            />
          </div>

          {formData.category === 'press' && (
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label htmlFor="source_name" className="admin-form-label">
                  출처 (매체명)
                </label>
                <input
                  type="text"
                  id="source_name"
                  name="source_name"
                  value={formData.source_name}
                  onChange={handleChange}
                  placeholder="예: 중앙일보"
                  className="admin-form-input"
                />
              </div>

              <div className="admin-form-group">
                <label htmlFor="external_url" className="admin-form-label">
                  기사 원문 링크
                </label>
                <input
                  type="url"
                  id="external_url"
                  name="external_url"
                  value={formData.external_url}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="admin-form-input"
                />
              </div>
            </div>
          )}

          {formData.category === 'video' && (
            <div className="admin-form-group">
              <label htmlFor="youtube_url" className="admin-form-label">
                YouTube 링크 <span className="required">*</span>
              </label>
              <input
                type="url"
                id="youtube_url"
                name="youtube_url"
                value={formData.youtube_url}
                onChange={handleChange}
                placeholder="https://www.youtube.com/watch?v=..."
                className="admin-form-input"
              />
              <p className="admin-form-help">
                상세 화면에 영상이 임베드됩니다. 대표 이미지가 없으면 YouTube 썸네일이 사용됩니다.
              </p>
            </div>
          )}

          <div className="admin-form-group">
            <label htmlFor="body_ko" className="admin-form-label">
              본문 (한글)
            </label>
            <textarea
              id="body_ko"
              name="body_ko"
              value={formData.body_ko}
              onChange={handleChange}
              rows={8}
              className="admin-form-textarea"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="body_en" className="admin-form-label">
              본문 (영문)
            </label>
            <textarea
              id="body_en"
              name="body_en"
              value={formData.body_en}
              onChange={handleChange}
              rows={8}
              className="admin-form-textarea"
            />
          </div>
        </div>

        <div className="admin-form-section">
          <h3 className="admin-form-section-title">대표 이미지</h3>
          <p className="admin-form-help">
            카드와 상세 화면 상단에 표시됩니다. 10MB 이하의 JPEG·PNG·WebP·GIF 파일을 올릴 수 있습니다.
          </p>

          {formData.thumbnail_url ? (
            <div className="admin-news-thumb-preview">
              <Image
                src={formData.thumbnail_url}
                alt="대표 이미지 미리보기"
                width={320}
                height={200}
                className="admin-news-thumb-img"
              />
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-outline"
                onClick={clearThumbnail}
              >
                이미지 제거
              </button>
            </div>
          ) : (
            <div className="admin-form-group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleThumbnailSelect}
                disabled={uploading}
                className="admin-form-input"
              />
              {uploading && <p className="admin-form-help">업로드 중...</p>}
            </div>
          )}

          <div className="admin-form-checkbox" style={{ marginTop: 20 }}>
            <input
              type="checkbox"
              id="is_published"
              name="is_published"
              checked={formData.is_published}
              onChange={handleChange}
            />
            <label htmlFor="is_published">공개 미디어 페이지에 표시</label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="admin-form-actions">
        {savedMsg && (
          <span className="admin-form-saved" role="status">✓ {savedMsg}</span>
        )}
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => router.back()}
          disabled={saving}
        >
          취소
        </button>
        <button
          type="submit"
          className={`admin-btn ${saved ? 'admin-btn-gold' : 'admin-btn-primary'}`}
          disabled={saving || uploading}
        >
          {saving ? '저장 중...' : saved ? '저장됨 ✓' : isNew ? '생성' : '저장'}
        </button>
      </div>
    </form>
  );
}
