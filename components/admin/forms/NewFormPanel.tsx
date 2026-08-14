'use client';

/**
 * NewFormPanel — 프리셋을 고르고 신청서를 만든다
 *
 * 빈 캔버스를 주지 않는다. 프리셋을 고르면 문항이 이미 들어 있고, 이후 편집은
 * 표에서 행을 고치는 일이 된다 — 이 시스템이 '폼 빌더'가 아닌 이유다.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/useT';
import type { FormKind } from '@/types/forms';

interface Preset {
  kind: FormKind;
  name: string;
  detail: string;
  slugHint: string;
}

const PRESET_CARDS: Preset[] = [
  {
    kind: 'season',
    name: '정규 학기 수강 신청서',
    detail: '학생 정보 · 등록 기간 · 과목 선택 · 공연/퍼레이드 동의 · 학원 규정 동의까지 16문항이 모두 들어 있습니다.',
    slugHint: '2027-2028-regular',
  },
  {
    kind: 'workshop',
    name: '특강 · 단기 신청서',
    detail: '이름 · 이메일 · 연락처 · 프로그램 · 동의 5칸짜리 짧은 신청서입니다. 만든 뒤 과목만 채우면 됩니다.',
    slugHint: 'winter-workshop',
  },
  {
    kind: 'survey',
    name: '설문',
    detail: '안내문 하나로 시작합니다. 질문은 만든 뒤 ‘추가 질문’ 탭에서 세웁니다.',
    slugHint: 'parent-survey',
  },
];

export default function NewFormPanel() {
  const t = useT();
  const router = useRouter();

  const [kind, setKind] = useState<FormKind>('season');
  const [titleKo, setTitleKo] = useState('');
  const [slug, setSlug] = useState('');
  const [season, setSeason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = PRESET_CARDS.find((p) => p.kind === kind)!;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          slug: slug.trim(),
          season: season.trim() || null,
          title_ko: titleKo.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || t('admin.forms.createFailed', '신청서를 만들지 못했습니다.'));
        setBusy(false);
        return;
      }
      router.push(`/admin/forms/${json.data.id}`);
    } catch {
      setError(t('admin.forms.createNetwork', '연결이 끊어졌습니다. 다시 시도해 주세요.'));
      setBusy(false);
    }
  }

  return (
    <form className="admin-card admin-form-new" onSubmit={handleCreate}>
      <fieldset className="admin-fieldset">
        <legend>{t('admin.forms.pickPreset', '어떤 신청서인가요')}</legend>
        <div className="preset-cards">
          {PRESET_CARDS.map((p) => (
            <label key={p.kind} className={`preset-card${kind === p.kind ? ' is-picked' : ''}`}>
              <input
                type="radio"
                name="kind"
                value={p.kind}
                checked={kind === p.kind}
                onChange={() => setKind(p.kind)}
              />
              <span className="preset-card-name">{p.name}</span>
              <span className="preset-card-detail">{p.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="admin-field">
        <label htmlFor="nf-title">{t('admin.forms.fieldTitle', '신청서 제목')}</label>
        <input
          id="nf-title"
          type="text"
          value={titleKo}
          onChange={(e) => setTitleKo(e.target.value)}
          placeholder="KTDOC 2027–2028 수강 신청서"
          required
        />
      </div>

      <div className="admin-field">
        <label htmlFor="nf-season">{t('admin.forms.fieldSeason', '학년도 (선택)')}</label>
        <input
          id="nf-season"
          type="text"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder="2027-2028"
        />
        <p className="admin-field-help">
          {t('admin.forms.fieldSeasonHelp', '응답을 학년도별로 모아 보고 정리할 때 쓰입니다.')}
        </p>
      </div>

      <div className="admin-field">
        <label htmlFor="nf-slug">{t('admin.forms.fieldSlug', '공개 주소')}</label>
        <div className="admin-slug-row">
          <span className="admin-slug-prefix">/f/</span>
          <input
            id="nf-slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder={picked.slugHint}
            required
          />
        </div>
        <p className="admin-field-help">
          {t(
            'admin.forms.fieldSlugHelp',
            '이 주소로 QR과 링크가 만들어집니다. 학년도를 넣어 두면 작년 신청서 주소가 그대로 살아 있습니다.'
          )}
        </p>
      </div>

      {error && (
        <div className="admin-alert admin-alert-error" role="alert">
          {error}
        </div>
      )}

      <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
        {busy
          ? t('admin.forms.creating', '만드는 중…')
          : t('admin.forms.create', '신청서 만들기')}
      </button>
      <p className="admin-field-help">
        {t(
          'admin.forms.createNote',
          '만들면 초안으로 시작합니다. 내용을 확인하고 게시해야 학부모님께 보입니다.'
        )}
      </p>
    </form>
  );
}
