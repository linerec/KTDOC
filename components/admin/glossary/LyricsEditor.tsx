'use client';

/**
 * 가사 줄 편집기 — 한 줄에 한국어·로마자·발음·영어 뜻, 후렴 표시
 *
 * 줄 순서가 곧 노래 순서다. 드래그 대신 위/아래 버튼을 쓴다 — 휴대폰에서도 되고,
 * 실수로 순서가 흐트러질 일이 없다. 마지막 한 줄은 지울 수 없다(빈 편집기 방지).
 */

import type { SongLineInput } from '@/types/glossary';
import { useT } from '@/lib/i18n/useT';

export interface LineRow extends SongLineInput {
  _key: string;
}

interface LyricsEditorProps {
  lines: LineRow[];
  onUpdate: (key: string, field: keyof SongLineInput, value: string | boolean) => void;
  onMove: (key: string, dir: -1 | 1) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}

export default function LyricsEditor({
  lines,
  onUpdate,
  onMove,
  onRemove,
  onAdd,
}: LyricsEditorProps) {
  const t = useT();

  return (
    <div className="admin-form-section">
      <h3 className="admin-form-section-title">{t('admin.songs.lyrics', '가사 (줄 단위)')}</h3>
      <p className="admin-form-help">
        {t(
          'admin.songs.lyricsHelp',
          '한 줄씩 입력하세요. 로마자·발음·영어 뜻은 선택입니다. 반복되는 후렴은 ‘후렴’에 체크하면 공개 화면에서 구분되어 표시됩니다. 위/아래 화살표로 순서를 바꿉니다.'
        )}
      </p>

      <div className="song-line-editor">
        {lines.map((line, idx) => (
          <div key={line._key} className={`song-line-row${line.is_refrain ? ' is-refrain' : ''}`}>
            <div className="song-line-order">
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-outline"
                onClick={() => onMove(line._key, -1)}
                disabled={idx === 0}
                aria-label={t('admin.songs.moveUp', '위로')}
              >
                ↑
              </button>
              <span className="song-line-num">{idx + 1}</span>
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-outline"
                onClick={() => onMove(line._key, 1)}
                disabled={idx === lines.length - 1}
                aria-label={t('admin.songs.moveDown', '아래로')}
              >
                ↓
              </button>
            </div>

            <div className="song-line-fields">
              <input
                type="text"
                className="admin-form-input"
                value={line.text_ko}
                onChange={(e) => onUpdate(line._key, 'text_ko', e.target.value)}
                placeholder={t('admin.songs.lineKo', '한국어 가사')}
              />
              <div className="admin-form-row">
                <input
                  type="text"
                  className="admin-form-input"
                  value={line.romanization}
                  onChange={(e) => onUpdate(line._key, 'romanization', e.target.value)}
                  placeholder={t('admin.songs.lineRoman', '로마자 (선택)')}
                />
                <input
                  type="text"
                  className="admin-form-input"
                  value={line.pronunciation}
                  onChange={(e) => onUpdate(line._key, 'pronunciation', e.target.value)}
                  placeholder={t('admin.songs.linePron', '발음 (선택)')}
                />
              </div>
              <input
                type="text"
                className="admin-form-input"
                value={line.text_en}
                onChange={(e) => onUpdate(line._key, 'text_en', e.target.value)}
                placeholder={t('admin.songs.lineEn', '영어 뜻 (선택)')}
              />
              <div className="song-line-controls">
                <label className="song-line-refrain">
                  <input
                    type="checkbox"
                    checked={!!line.is_refrain}
                    onChange={(e) => onUpdate(line._key, 'is_refrain', e.target.checked)}
                  />
                  {t('admin.songs.refrain', '후렴')}
                </label>
                <button
                  type="button"
                  className="admin-btn admin-btn-sm admin-btn-danger"
                  onClick={() => onRemove(line._key)}
                  disabled={lines.length <= 1}
                >
                  {t('admin.songs.removeLine', '줄 삭제')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="admin-btn admin-btn-sm admin-btn-outline" onClick={onAdd}>
        {t('admin.songs.addLine', '+ 줄 추가')}
      </button>
    </div>
  );
}
