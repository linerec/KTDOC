'use client';

/**
 * NewsForm — 뉴스·미디어 게시물 생성/편집
 *
 * 폼 상태와 저장만 여기서 맡고, 화면은 두 조각으로 갈랐다:
 *  - PostFields     : 분류·게시일·제목·본문 (분류에 따라 필요한 칸이 달라진다)
 *  - ThumbnailField : 대표 이미지 업로드와 공개 여부
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NewsPost, NewsCategory, CreateNewsPostInput, UpdateNewsPostInput } from '@/types/news';
import { uploadImageFile } from '@/lib/uploadClient';
import { useT } from '@/lib/i18n/useT';
import PostFields, { type NewsFormData } from './PostFields';
import ThumbnailField from './ThumbnailField';

interface NewsFormProps {
  post?: NewsPost | null;
  isNew?: boolean;
}

export default function NewsForm({ post, isNew = false }: NewsFormProps) {
  const router = useRouter();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 저장 완료 피드백(편집 시 화면 변화가 없어 명확한 신호가 필요)
  const [saved, setSaved] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<NewsFormData>({
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
      const res = await uploadImageFile<{
        success: boolean;
        data: { url: string; key: string };
      }>('/api/admin/news/upload', file, {
        failMessage: t('admin.news.uploadFailed', '이미지 업로드에 실패했습니다.'),
      });
      setFormData((prev) => ({
        ...prev,
        thumbnail_url: res.data.url,
        thumbnail_r2_key: res.data.key,
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.news.uploadFailed', '이미지 업로드에 실패했습니다.')
      );
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
      setError(t('admin.news.youtubeRequired', '영상 게시물에는 YouTube 링크가 필요합니다.'));
      return;
    }

    setSaving(true);
    try {
      const url = isNew ? '/api/admin/news' : `/api/admin/news/${post?.id}`;

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
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.saveFailed', '저장에 실패했습니다.'));
      }

      if (isNew) {
        router.push('/admin/news');
        router.refresh();
      } else {
        setSaved(true);
        setSavedMsg(t('admin.news.saved', '저장되었습니다.'));
        router.refresh();
        window.setTimeout(() => setSaved(false), 3000);
      }
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
        <PostFields formData={formData} onChange={handleChange} />
        <ThumbnailField
          formData={formData}
          onChange={handleChange}
          onSelectFile={handleThumbnailSelect}
          onClear={clearThumbnail}
          uploading={uploading}
          fileInputRef={fileInputRef}
        />
      </div>

      <div className="admin-form-actions">
        {savedMsg && (
          <span className="admin-form-saved" role="status">
            ✓ {savedMsg}
          </span>
        )}
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => router.back()}
          disabled={saving}
        >
          {t('admin.common.cancel', '취소')}
        </button>
        <button
          type="submit"
          className={`admin-btn ${saved ? 'admin-btn-gold' : 'admin-btn-primary'}`}
          disabled={saving || uploading}
        >
          {saving
            ? t('admin.common.saving', '저장 중...')
            : saved
              ? t('admin.common.savedMark', '저장됨 ✓')
              : isNew
                ? t('admin.common.create', '생성')
                : t('admin.common.save', '저장')}
        </button>
      </div>
    </form>
  );
}
