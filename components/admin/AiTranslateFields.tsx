'use client';

/**
 * AiTranslateFields — 한국어로 적은 칸들을 영문 칸에 한 번에 채우는 띠
 *
 * 관리 콘솔의 콘텐츠는 대부분 한/영 두 벌인데, 영문 칸은 늘 비어 있었다. 손으로
 * 옮겨 적을 수 있는 사람이 없어서다. 그 결과 영어가 편한 가족은 안내를 못 읽었다.
 *
 * 쓰는 쪽은 채울 칸 목록만 넘긴다(공연 폼·수업 폼·뉴스 등 어디서나 같다):
 *
 *   <AiTranslateFields
 *     fields={[{ key: 'title_en', label: '제목', ko: f.title_ko, en: f.title_en }, …]}
 *     onApply={patchForm}
 *   />
 *
 * 설계에서 정한 것 세 가지:
 *
 * 1. **한 번에 한 요청.** 제목·준비물·설명은 같은 공연을 말한다. 따로 부르면 작품
 *    이름이 칸마다 다르게 번역된다. 함께 보내면 모델이 이름을 통일한다.
 * 2. **이미 채워진 영문은 기본으로 건드리지 않는다.** 사람이 쓴 문장을 기계 번역이
 *    조용히 덮는 일이 없어야 한다. 덮으려면 체크박스를 켠다 — 무엇이 일어날지
 *    버튼을 누르기 전에 화면이 말한다.
 * 3. **채우고 끝. 저장은 사람이 한다.** 결과는 폼에만 들어가고 DB에 바로 쓰지
 *    않는다. 기계 번역이 확인 없이 학부모에게 나가는 길을 만들지 않는다.
 */

import { useState } from 'react';
import { useT } from '@/lib/i18n/useT';

export interface TranslatableField<K extends string = string> {
  /** 채울 영문 칸의 필드명 (예: 'prep_notes_en') */
  key: K;
  /** 사람이 읽는 칸 이름 — 안내 문구와 모델 프롬프트에 함께 쓴다 */
  label: string;
  /** 한국어 원문 (비어 있으면 대상에서 빠진다) */
  ko: string;
  /** 현재 영문 값 (차 있으면 기본적으로 건너뛴다) */
  en: string;
}

/**
 * key를 제네릭으로 둔 이유: 부모의 패치 함수(`patchForm`)를 캐스팅 없이 그대로 넘기려면
 * "채우는 키는 이 셋뿐"임이 타입에 남아 있어야 한다. 그래야 폼에 없는 이름을 key로
 * 적는 실수를 빌드가 잡는다.
 */
interface AiTranslateFieldsProps<K extends string> {
  fields: TranslatableField<K>[];
  /** 번역 결과를 폼에 꽂는다 — { 필드명: 영문 } */
  onApply: (patch: Partial<Record<K, string>>) => void;
}

export default function AiTranslateFields<K extends string>({
  fields,
  onApply,
}: AiTranslateFieldsProps<K>) {
  const t = useT();
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // 한국어가 있는 칸만 후보다. 그중 실제로 보낼 것은 영문이 빈 칸(또는 덮기 허용 시 전부).
  const candidates = fields.filter((f) => f.ko.trim());
  const targets = candidates.filter((f) => overwrite || !f.en.trim());
  const alreadyFilled = candidates.filter((f) => f.en.trim());

  const handleTranslate = async () => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const res = await fetch('/api/admin/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: targets.map((f) => ({ key: f.key, label: f.label, ko: f.ko })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || t('admin.translate.failed', '번역에 실패했습니다. 다시 시도해 주세요.')
        );
      }

      const translations = (data.translations ?? {}) as Partial<Record<K, string>>;
      onApply(translations);

      const filledLabels = targets
        .filter((f) => translations[f.key])
        .map((f) => f.label)
        .join(' · ');
      const missedLabels = targets
        .filter((f) => !translations[f.key])
        .map((f) => f.label)
        .join(' · ');

      setNote(
        [
          t('admin.translate.filled', '{fields} 영문을 채웠습니다. 검토하신 뒤 저장하세요.', {
            fields: filledLabels,
          }),
          missedLabels &&
            t('admin.translate.missed', '받지 못한 칸: {fields}', { fields: missedLabels }),
        ]
          .filter(Boolean)
          .join(' ')
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.translate.failed', '번역에 실패했습니다. 다시 시도해 주세요.')
      );
    } finally {
      setBusy(false);
    }
  };

  // 한국어가 하나도 없으면 띠 자체를 띄우지 않는다 — 누를 수 없는 버튼을 보여 주지 않는다.
  if (candidates.length === 0) return null;

  return (
    <div className="ai-translate">
      <div className="ai-translate-head">
        <span className="ai-translate-title">
          {t('admin.translate.title', '한국어에서 영문 채우기')}
        </span>
        <p className="ai-translate-help">
          {t(
            'admin.translate.help',
            '위에 적으신 한국어를 AI가 영어로 옮겨 영문 칸에 채웁니다. 채워진 값은 초안이니 검토하신 뒤 저장하세요. 어떤 모델을 쓸지는 AI 설정의 ‘문구 다듬기 · 번역 보조’에서 정합니다.'
          )}
        </p>
      </div>

      <div className="ai-translate-actions">
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={handleTranslate}
          disabled={busy || targets.length === 0}
        >
          {busy
            ? t('admin.translate.working', '번역 중…')
            : t('admin.translate.run', '영문으로 번역')}
        </button>

        <span className="ai-translate-scope">
          {targets.length > 0
            ? t('admin.translate.scope', '옮길 칸: {fields}', {
                fields: targets.map((f) => f.label).join(' · '),
              })
            : t(
                'admin.translate.allFilled',
                '영문이 모두 채워져 있습니다. 다시 번역하려면 아래를 켜 주세요.'
              )}
        </span>
      </div>

      {alreadyFilled.length > 0 && (
        <label className="ai-translate-overwrite">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
          <span>
            {t('admin.translate.overwrite', '이미 적혀 있는 영문도 새로 번역 ({fields})', {
              fields: alreadyFilled.map((f) => f.label).join(' · '),
            })}
          </span>
        </label>
      )}

      {note && (
        <p className="admin-alert ai-translate-note" role="status">
          {note}
        </p>
      )}
      {error && (
        <p className="admin-alert admin-alert-error ai-translate-note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
