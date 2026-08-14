'use client';

/**
 * FormEditor — 신청서를 고친다
 *
 * **폼 빌더가 아니라 표 편집기다.** 빈 캔버스에서 문항을 조립하는 화면은 존재하지
 * 않는다. 프리셋이 문항을 이미 세워 두었고, 여기서는 표에서 행을 고친다 —
 * 원장이 준비물·Q&A 관리에서 이미 해 본 조작이다.
 *
 * 스키마를 손대는 조작은 전부 lib/forms/edit.ts(순수 함수 + 시험)에 있다.
 * 저장은 서버가 게이트를 다시 통과시키고, 잠긴 신청서의 파괴적 편집은 409로 막는다.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ShareQrCard from '@/components/share/ShareQrCard';
import { useT } from '@/lib/i18n/useT';
import { allQuestions } from '@/lib/forms/schema';
import { addOption, addQuestion, allKeys, makeKey, moveOption, patchOption, patchQuestion } from '@/lib/forms/edit';
import type { ProvisionalNote } from '@/lib/forms/provisionalNotes';
import type { FormOption, FormQuestion, FormRow, FormSchema, QuestionType } from '@/types/forms';
import OptionTable, { type ProgramChoice } from './OptionTable';
import ReadinessPanel from './ReadinessPanel';

type TabKey = 'basic' | 'classes' | 'consent' | 'extras' | 'share';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'basic', label: '기본' },
  { key: 'classes', label: '과목 · 기간' },
  { key: 'consent', label: '동의 · 안내' },
  { key: 'extras', label: '추가 질문' },
  { key: 'share', label: '공유' },
];

const EXTRA_TYPES: Array<{ value: QuestionType; label: string }> = [
  { value: 'short', label: '단답' },
  { value: 'long', label: '장문' },
  { value: 'single', label: '하나 고르기' },
];

interface FormEditorProps {
  form: FormRow;
  initialSchema: FormSchema;
  warnings: string[];
  dirtyCount: number;
  provisionalNotes: ProvisionalNote[];
  programs: ProgramChoice[];
}

export default function FormEditor({
  form,
  initialSchema,
  warnings,
  dirtyCount,
  provisionalNotes,
  programs,
}: FormEditorProps) {
  const t = useT();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>('basic');
  const [schema, setSchema] = useState<FormSchema>(initialSchema);
  const [meta, setMeta] = useState({
    title_ko: form.title_ko,
    title_en: form.title_en ?? '',
    description_ko: form.description_ko ?? '',
    description_en: form.description_en ?? '',
    season: form.season ?? '',
    requires_login: form.requires_login === 1,
  });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const locked = form.locked_at != null;
  const questions = useMemo(() => allQuestions(schema), [schema]);
  const classQuestion = questions.find((q) => q.selectionOf);
  const periodQuestion = questions.find((q) => q.key.includes('period') && q.type === 'single');
  const consentQuestions = questions.filter((q) => q.consentKey || q.type === 'info');
  const extrasSection = schema.sections.find((s) => s.key === 'extras');
  const consentCount = questions.filter((q) => q.consentKey).length;

  function mutate(next: FormSchema) {
    setSchema(next);
    setDirty(true);
    setMessage(null);
  }

  function editMeta(patch: Partial<typeof meta>) {
    setMeta((m) => ({ ...m, ...patch }));
    setDirty(true);
    setMessage(null);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema,
          meta: {
            title_ko: meta.title_ko.trim(),
            title_en: meta.title_en.trim() || null,
            description_ko: meta.description_ko.trim() || null,
            description_en: meta.description_en.trim() || null,
            season: meta.season.trim() || null,
            requires_login: meta.requires_login ? 1 : 0,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setMessage({ kind: 'err', text: json.error || '저장하지 못했습니다.' });
        setBusy(false);
        return;
      }
      setDirty(false);
      setMessage({ kind: 'ok', text: '저장했습니다.' });
      router.refresh();
    } catch {
      setMessage({ kind: 'err', text: '연결이 끊어졌습니다. 다시 시도해 주세요.' });
    }
    setBusy(false);
  }

  /** 임시 게시 시작·해제 — 저장 여부만 다르고 화면은 진짜와 같다. */
  async function trial(on: boolean) {
    if (busy) return;
    if (dirty) {
      setMessage({ kind: 'err', text: '저장하지 않은 변경이 있습니다. 먼저 저장해 주세요.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/forms/${form.id}/trial`, {
        method: on ? 'POST' : 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setMessage({ kind: 'err', text: json.error || '처리하지 못했습니다.' });
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setMessage({ kind: 'err', text: '연결이 끊어졌습니다.' });
    }
    setBusy(false);
  }

  async function act(path: 'publish' | 'close', confirmText: string) {
    if (busy) return;
    if (dirty) {
      setMessage({ kind: 'err', text: '저장하지 않은 변경이 있습니다. 먼저 저장해 주세요.' });
      return;
    }
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/forms/${form.id}/${path}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setMessage({ kind: 'err', text: json.error || '처리하지 못했습니다.' });
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setMessage({ kind: 'err', text: '연결이 끊어졌습니다.' });
    }
    setBusy(false);
  }

  function addExtra(type: QuestionType, labelKo: string) {
    const key = makeKey(`extra ${labelKo}`, allKeys(schema));
    const q: FormQuestion = {
      key,
      type,
      required: false,
      label: { ko: labelKo, en: '' },
      ...(type === 'single' ? { options: [{ key: `${key}_1`, label: { ko: '보기 1', en: '' } }] } : {}),
    };
    mutate(addQuestion(schema, 'extras', q));
  }

  return (
    <div className="form-editor">
      <div className="form-editor-actions">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={save}
          disabled={busy || !dirty}
        >
          {busy ? '저장 중…' : dirty ? '저장' : '저장됨'}
        </button>

        {form.status === 'draft' && (
          <button
            type="button"
            className="admin-btn admin-btn-outline"
            onClick={() => trial(true)}
            disabled={busy}
            title="링크를 아는 사람이 열어 볼 수 있게 하되, 제출해도 저장되지 않습니다"
          >
            임시로 게시하기
          </button>
        )}

        {form.status === 'trial' && (
          <>
            <a
              href={`/f/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="admin-btn admin-btn-outline"
            >
              임시 게시 화면 열기
            </a>
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={() => trial(false)}
              disabled={busy}
            >
              임시 게시 해제
            </button>
          </>
        )}

        {(form.status === 'draft' || form.status === 'trial') && (
          <button
            type="button"
            className="admin-btn admin-btn-gold"
            onClick={() =>
              act(
                'publish',
                '지금 정식으로 게시하면 학부모님들의 신청이 실제로 저장되기 시작합니다.\n\n첫 신청이 들어오면 과목 항목을 나누거나 지울 수 없게 됩니다. 계속할까요?'
              )
            }
            disabled={busy}
          >
            게시하기
          </button>
        )}

        {form.status === 'open' && (
          <>
            <a
              href={`/f/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="admin-btn admin-btn-outline"
            >
              공개 페이지 보기
            </a>
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={() => act('close', '접수를 마감할까요? 이미 들어온 응답은 그대로 남습니다.')}
              disabled={busy}
            >
              접수 마감
            </button>
          </>
        )}

        {form.status === 'draft' && (
          <a
            href={`/f/${form.slug}`}
            target="_blank"
            rel="noreferrer"
            className="admin-btn admin-btn-outline"
          >
            미리 보기
          </a>
        )}

        <Link href={`/admin/forms/${form.id}/responses`} className="admin-btn admin-btn-outline">
          응답 보기
        </Link>
      </div>

      {message && (
        <div
          className={`admin-alert ${message.kind === 'ok' ? 'admin-alert-success' : 'admin-alert-error'}`}
          role="status"
        >
          {message.text}
        </div>
      )}

      <ReadinessPanel
        warnings={warnings}
        dirtyCount={dirtyCount}
        provisionalNotes={provisionalNotes}
        consentCount={consentCount}
        locked={locked}
      />

      <div className="admin-page-tabs" role="tablist">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            aria-selected={tab === tb.key}
            className={`admin-page-tab${tab === tb.key ? ' is-active' : ''}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── 기본 ───────────────────────────────────────── */}
      {tab === 'basic' && (
        <div className="admin-card form-editor-panel">
          <div className="admin-field-pair">
            <div className="admin-field">
              <label htmlFor="fe-title-ko">제목 (한국어)</label>
              <input
                id="fe-title-ko"
                type="text"
                value={meta.title_ko}
                onChange={(e) => editMeta({ title_ko: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="fe-title-en">Title (English)</label>
              <input
                id="fe-title-en"
                type="text"
                value={meta.title_en}
                onChange={(e) => editMeta({ title_en: e.target.value })}
              />
            </div>
          </div>

          <div className="admin-field-pair">
            <div className="admin-field">
              <label htmlFor="fe-desc-ko">안내문 (한국어)</label>
              <textarea
                id="fe-desc-ko"
                rows={5}
                value={meta.description_ko}
                onChange={(e) => editMeta({ description_ko: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="fe-desc-en">Description (English)</label>
              <textarea
                id="fe-desc-en"
                rows={5}
                value={meta.description_en}
                onChange={(e) => editMeta({ description_en: e.target.value })}
              />
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor="fe-season">학년도</label>
            <input
              id="fe-season"
              type="text"
              value={meta.season}
              onChange={(e) => editMeta({ season: e.target.value })}
              placeholder="2026-2027"
            />
          </div>

          <div className="admin-field">
            <label className="opt-toggle">
              <input
                type="checkbox"
                checked={meta.requires_login}
                onChange={(e) => editMeta({ requires_login: e.target.checked })}
              />
              <span>로그인해야 작성할 수 있게 하기</span>
            </label>
            <p className="admin-field-help">
              켜면 회원만 신청할 수 있습니다. 끄면 링크를 받은 누구나 바로 작성할 수 있고, 회원이면
              이름·이메일이 자동으로 채워집니다.
            </p>
          </div>

          <div className="admin-field">
            <label>공개 주소</label>
            <p className="admin-field-help">
              <code>/f/{form.slug}</code> — 주소는 만든 뒤에 바꾸지 않습니다. 이미 뿌린 QR과 링크가
              끊어지기 때문입니다.
            </p>
          </div>
        </div>
      )}

      {/* ── 과목 · 기간 ────────────────────────────────── */}
      {tab === 'classes' && (
        <div className="admin-card form-editor-panel">
          {classQuestion ? (
            <>
              <h3 className="form-editor-h3">{classQuestion.label.ko}</h3>
              <p className="admin-field-help">
                여기 적은 이름이 신청서에 그대로 보입니다. <strong>수업을 연결해 두면</strong> 신청을
                받은 뒤 버튼 한 번으로 그 학생을 수업 명단에 넣을 수 있습니다.
              </p>
              <OptionTable
                options={classQuestion.options ?? []}
                programs={programs}
                showClassColumns
                locked={locked}
                onPatch={(k, patch) => mutate(patchOption(schema, classQuestion.key, k, patch))}
                onMove={(k, d) => mutate(moveOption(schema, classQuestion.key, k, d))}
                onAdd={(labelKo) => {
                  const opt: FormOption = {
                    key: makeKey(labelKo, allKeys(schema)),
                    label: { ko: labelKo, en: '' },
                  };
                  mutate(addOption(schema, classQuestion.key, opt));
                }}
              />
            </>
          ) : (
            <p className="admin-field-help">이 신청서에는 과목 선택 문항이 없습니다.</p>
          )}

          {periodQuestion && (
            <>
              <h3 className="form-editor-h3">{periodQuestion.label.ko}</h3>
              <OptionTable
                options={periodQuestion.options ?? []}
                programs={programs}
                showClassColumns={false}
                locked={locked}
                onPatch={(k, patch) => mutate(patchOption(schema, periodQuestion.key, k, patch))}
                onMove={(k, d) => mutate(moveOption(schema, periodQuestion.key, k, d))}
                onAdd={(labelKo) => {
                  const opt: FormOption = {
                    key: makeKey(labelKo, allKeys(schema)),
                    label: { ko: labelKo, en: '' },
                  };
                  mutate(addOption(schema, periodQuestion.key, opt));
                }}
              />
            </>
          )}
        </div>
      )}

      {/* ── 동의 · 안내 ────────────────────────────────── */}
      {tab === 'consent' && (
        <div className="admin-card form-editor-panel">
          <p className="admin-field-help">
            동의 항목의 문구는 <strong>제출한 시점 그대로 보관</strong>됩니다. 나중에 문구를 고쳐도
            이미 낸 분들이 읽은 원문은 그대로 남습니다.
          </p>

          {consentQuestions.length === 0 && (
            <p className="admin-field-help">동의·안내 항목이 없습니다.</p>
          )}

          {consentQuestions.map((q) => (
            <div key={q.key} className="consent-editor">
              <div className="consent-editor-head">
                <span className="admin-badge admin-badge-muted">
                  {q.type === 'info' ? '안내문' : q.type === 'consent' ? '동의 체크' : '예 / 아니오'}
                </span>
                {q.showIf && (
                  <span className="admin-badge admin-badge-warning">해당자에게만 표시</span>
                )}
                {q.type !== 'info' && (
                  <label className="opt-toggle">
                    <input
                      type="checkbox"
                      checked={q.required}
                      disabled={locked && !q.required}
                      onChange={(e) => mutate(patchQuestion(schema, q.key, { required: e.target.checked }))}
                    />
                    <span>필수</span>
                  </label>
                )}
              </div>

              <div className="admin-field-pair">
                <div className="admin-field">
                  <label htmlFor={`ce-lko-${q.key}`}>
                    {q.type === 'info' ? '제목 (한국어)' : '동의 문구 (한국어)'}
                  </label>
                  <input
                    id={`ce-lko-${q.key}`}
                    type="text"
                    value={q.label.ko}
                    onChange={(e) =>
                      mutate(patchQuestion(schema, q.key, { label: { ...q.label, ko: e.target.value } }))
                    }
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor={`ce-len-${q.key}`}>English</label>
                  <input
                    id={`ce-len-${q.key}`}
                    type="text"
                    value={q.label.en ?? ''}
                    onChange={(e) =>
                      mutate(patchQuestion(schema, q.key, { label: { ...q.label, en: e.target.value } }))
                    }
                  />
                </div>
              </div>

              <div className="admin-field-pair">
                <div className="admin-field">
                  <label htmlFor={`ce-hko-${q.key}`}>안내 본문 (한국어)</label>
                  <textarea
                    id={`ce-hko-${q.key}`}
                    rows={6}
                    value={q.help?.ko ?? ''}
                    onChange={(e) =>
                      mutate(
                        patchQuestion(schema, q.key, {
                          help: { ko: e.target.value, en: q.help?.en ?? '' },
                        })
                      )
                    }
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor={`ce-hen-${q.key}`}>English</label>
                  <textarea
                    id={`ce-hen-${q.key}`}
                    rows={6}
                    value={q.help?.en ?? ''}
                    onChange={(e) =>
                      mutate(
                        patchQuestion(schema, q.key, {
                          help: { ko: q.help?.ko ?? '', en: e.target.value },
                        })
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 추가 질문 ──────────────────────────────────── */}
      {tab === 'extras' && (
        <div className="admin-card form-editor-panel">
          <p className="admin-field-help">
            학년도마다 따로 묻고 싶은 것을 여기에 세웁니다. 이 답은 <strong>응답 상세 화면과
            내려받는 표의 맨 끝</strong>에 나옵니다 — 과목별 명단이나 집계에는 쓰이지 않습니다.
          </p>

          <ExtraAdder onAdd={addExtra} />

          {(extrasSection?.questions.length ?? 0) === 0 ? (
            <p className="admin-field-help">아직 추가한 질문이 없습니다.</p>
          ) : (
            extrasSection!.questions.map((q) => (
              <div key={q.key} className="consent-editor">
                <div className="consent-editor-head">
                  <span className="admin-badge admin-badge-muted">
                    {EXTRA_TYPES.find((x) => x.value === q.type)?.label ?? q.type}
                  </span>
                  <label className="opt-toggle">
                    <input
                      type="checkbox"
                      checked={q.required}
                      disabled={locked && !q.required}
                      onChange={(e) => mutate(patchQuestion(schema, q.key, { required: e.target.checked }))}
                    />
                    <span>필수</span>
                  </label>
                  <label className="opt-toggle">
                    <input
                      type="checkbox"
                      checked={!q.retired}
                      onChange={(e) => mutate(patchQuestion(schema, q.key, { retired: !e.target.checked }))}
                    />
                    <span>{q.retired ? '사용 안 함' : '사용'}</span>
                  </label>
                </div>
                <div className="admin-field-pair">
                  <div className="admin-field">
                    <label htmlFor={`xe-ko-${q.key}`}>질문 (한국어)</label>
                    <input
                      id={`xe-ko-${q.key}`}
                      type="text"
                      value={q.label.ko}
                      onChange={(e) =>
                        mutate(patchQuestion(schema, q.key, { label: { ...q.label, ko: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="admin-field">
                    <label htmlFor={`xe-en-${q.key}`}>English</label>
                    <input
                      id={`xe-en-${q.key}`}
                      type="text"
                      value={q.label.en ?? ''}
                      onChange={(e) =>
                        mutate(patchQuestion(schema, q.key, { label: { ...q.label, en: e.target.value } }))
                      }
                    />
                  </div>
                </div>

                {q.type === 'single' && (
                  <OptionTable
                    options={q.options ?? []}
                    programs={programs}
                    showClassColumns={false}
                    locked={locked}
                    onPatch={(k, patch) => mutate(patchOption(schema, q.key, k, patch))}
                    onMove={(k, d) => mutate(moveOption(schema, q.key, k, d))}
                    onAdd={(labelKo) =>
                      mutate(
                        addOption(schema, q.key, {
                          key: makeKey(labelKo, allKeys(schema)),
                          label: { ko: labelKo, en: '' },
                        })
                      )
                    }
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── 공유 ───────────────────────────────────────── */}
      {tab === 'share' && (
        <div className="admin-card form-editor-panel">
          {form.status === 'open' ? (
            <>
              <p className="admin-field-help">
                아래 QR을 저장하거나 주소를 복사해 카톡·문자로 보내세요. 휴대폰으로 스캔하면 바로
                신청서가 열립니다.
              </p>
              <ShareQrCard
                title={form.title_ko}
                path={`/f/${form.slug}`}
                hint={t('admin.forms.qrHint', '휴대폰으로 스캔하면 신청서가 열립니다')}
              />
            </>
          ) : (
            <p className="admin-field-help">
              아직 게시하지 않아 공유 주소가 열려 있지 않습니다. <strong>게시하기</strong>를 누르면
              QR과 링크가 만들어집니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** 추가 질문 한 줄 세우기 — 유형 3종만 준다(설계가 그은 선). */
function ExtraAdder({ onAdd }: { onAdd: (type: QuestionType, labelKo: string) => void }) {
  const [type, setType] = useState<QuestionType>('short');
  const [label, setLabel] = useState('');

  return (
    <div className="opt-add">
      <div className="admin-field opt-field-narrow">
        <label htmlFor="xa-type">유형</label>
        <select id="xa-type" value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
          {EXTRA_TYPES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
      </div>
      <div className="admin-field">
        <label htmlFor="xa-label">질문</label>
        <input
          id="xa-label"
          type="text"
          value={label}
          placeholder="예: 형제자매가 함께 등록하시나요?"
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="admin-btn admin-btn-outline"
        disabled={!label.trim()}
        onClick={() => {
          onAdd(type, label.trim());
          setLabel('');
        }}
      >
        질문 추가
      </button>
    </div>
  );
}
