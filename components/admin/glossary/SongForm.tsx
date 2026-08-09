'use client';

/**
 * SongForm
 * 말모이 노래(노랫말) 생성/편집 폼. 메타 정보 + 가사 줄 편집기.
 * 가사는 줄 단위로 한국어/로마자/발음/영어를 입력하고, 후렴은 체크로 표시한다.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  GlossarySongWithLines,
  CreateGlossarySongInput,
  UpdateGlossarySongInput,
  SongLineInput,
} from '@/types/glossary';
import { useT } from '@/lib/i18n/useT';
import LyricsEditor, { type LineRow } from './LyricsEditor';

interface SongFormProps {
  song?: GlossarySongWithLines | null;
  isNew?: boolean;
}

let keySeq = 0;
const nextKey = () => `line-${keySeq++}`;

function emptyLine(): LineRow {
  return { _key: nextKey(), text_ko: '', romanization: '', pronunciation: '', text_en: '', is_refrain: false };
}

export default function SongForm({ song, isNew = false }: SongFormProps) {
  const router = useRouter();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [meta, setMeta] = useState({
    title_ko: song?.title_ko || '',
    title_en: song?.title_en || '',
    romanization: song?.romanization || '',
    pronunciation: song?.pronunciation || '',
    description_ko: song?.description_ko || '',
    description_en: song?.description_en || '',
    youtube_url: song?.youtube_url || '',
    is_published: song ? song.is_published === 1 : true,
  });

  const [lines, setLines] = useState<LineRow[]>(
    song?.lines?.length
      ? song.lines.map((l) => ({
          _key: nextKey(),
          text_ko: l.text_ko,
          romanization: l.romanization || '',
          pronunciation: l.pronunciation || '',
          text_en: l.text_en || '',
          is_refrain: l.is_refrain === 1,
        }))
      : [emptyLine()]
  );

  const handleMeta = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setMeta((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const updateLine = (key: string, field: keyof SongLineInput, value: string | boolean) => {
    setLines((prev) => prev.map((l) => (l._key === key ? { ...l, [field]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (key: string) =>
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l._key !== key)));

  const moveLine = (key: string, dir: -1 | 1) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l._key === key);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!meta.title_ko.trim()) {
      setError(t('admin.songs.titleRequired', '노래 제목(한글)은 필수입니다.'));
      return;
    }

    const cleanLines: SongLineInput[] = lines
      .filter((l) => l.text_ko.trim())
      .map((l) => ({
        text_ko: l.text_ko.trim(),
        romanization: l.romanization?.trim() || undefined,
        pronunciation: l.pronunciation?.trim() || undefined,
        text_en: l.text_en?.trim() || undefined,
        is_refrain: !!l.is_refrain,
      }));

    setSaving(true);
    try {
      const url = isNew ? '/api/admin/glossary/songs' : `/api/admin/glossary/songs/${song?.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const body: CreateGlossarySongInput | UpdateGlossarySongInput = {
        title_ko: meta.title_ko.trim(),
        title_en: meta.title_en || undefined,
        romanization: meta.romanization || undefined,
        pronunciation: meta.pronunciation || undefined,
        description_ko: meta.description_ko || undefined,
        description_en: meta.description_en || undefined,
        youtube_url: meta.youtube_url || undefined,
        is_published: meta.is_published,
        lines: cleanLines,
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

      router.push('/admin/glossary/songs');
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
        {/* 노래 정보 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">{t('admin.songs.info', '노래 정보')}</h3>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="title_ko" className="admin-form-label">
                {t('admin.common.fieldTitleKo', '제목 (한글)')} <span className="required">*</span>
              </label>
              <input
                type="text"
                id="title_ko"
                name="title_ko"
                value={meta.title_ko}
                onChange={handleMeta}
                required
                className="admin-form-input"
                placeholder={t('admin.songs.titlePlaceholder', '별달거리')}
              />
            </div>
            <div className="admin-form-group">
              <label htmlFor="title_en" className="admin-form-label">
                {t('admin.songs.titleEn', '제목 (영문/의미)')}
              </label>
              <input
                type="text"
                id="title_en"
                name="title_en"
                value={meta.title_en}
                onChange={handleMeta}
                className="admin-form-input"
                placeholder="Byeoldalgeori (Star-Picking Song)"
              />
            </div>
          </div>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="romanization" className="admin-form-label">
                {t('admin.songs.titleRoman', '제목 로마자')}
              </label>
              <input
                type="text"
                id="romanization"
                name="romanization"
                value={meta.romanization}
                onChange={handleMeta}
                className="admin-form-input"
                placeholder="byeoldalgeori"
              />
            </div>
            <div className="admin-form-group">
              <label htmlFor="pronunciation" className="admin-form-label">
                {t('admin.songs.titlePron', '제목 발음')}
              </label>
              <input
                type="text"
                id="pronunciation"
                name="pronunciation"
                value={meta.pronunciation}
                onChange={handleMeta}
                className="admin-form-input"
                placeholder="byeol-dal-geo-ri"
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="youtube_url" className="admin-form-label">
              {t('admin.songs.youtube', '유튜브/음원 링크')}
            </label>
            <input
              type="url"
              id="youtube_url"
              name="youtube_url"
              value={meta.youtube_url}
              onChange={handleMeta}
              className="admin-form-input"
              placeholder="https://youtu.be/..."
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="description_ko" className="admin-form-label">
              {t('admin.songs.descKo', '노래 설명 (한글)')}
            </label>
            <textarea
              id="description_ko"
              name="description_ko"
              value={meta.description_ko}
              onChange={handleMeta}
              rows={2}
              className="admin-form-textarea"
              placeholder={t(
                'admin.songs.descPlaceholder',
                '어떤 노래인지, 어떤 무대에서 부르는지 짧게 소개하세요.'
              )}
            />
          </div>
          <div className="admin-form-group">
            <label htmlFor="description_en" className="admin-form-label">
              {t('admin.songs.descEn', '노래 설명 (영문)')}
            </label>
            <textarea
              id="description_en"
              name="description_en"
              value={meta.description_en}
              onChange={handleMeta}
              rows={2}
              className="admin-form-textarea"
            />
          </div>
        </div>

        <LyricsEditor
          lines={lines}
          onUpdate={updateLine}
          onMove={moveLine}
          onRemove={removeLine}
          onAdd={addLine}
        />

        {/* 공개 설정 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">
            {t('admin.common.secVisibility', '공개 설정')}
          </h3>
          <div className="admin-form-checkbox">
            <input
              type="checkbox"
              id="is_published"
              name="is_published"
              checked={meta.is_published}
              onChange={handleMeta}
            />
            <label htmlFor="is_published">
              {t('admin.songs.publishLabel', '공개 (체크하면 말모이 ‘노래’ 탭에 표시됩니다)')}
            </label>
          </div>
        </div>
      </div>

      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => router.push('/admin/glossary/songs')}
          disabled={saving}
        >
          {t('admin.common.cancel', '취소')}
        </button>
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
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
