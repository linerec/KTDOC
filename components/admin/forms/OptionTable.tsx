'use client';

/**
 * OptionTable — 선택지를 표로 고친다
 *
 * 이 화면이 이 시스템의 성패를 가른다. 저장은 유연한 JSON 이지만, 원장이 마주하는
 * 것은 준비물·Q&A 관리에서 이미 해 본 **표 조작**이어야 한다.
 *
 * 잠긴 신청서(첫 제출 이후)에서는 삭제 버튼이 '사용 안 함' 토글로 바뀐다.
 * 진짜로 지우면 이미 낸 응답이 가리킬 곳을 잃기 때문이다.
 */

import { useState } from 'react';
import type { FormOption } from '@/types/forms';

export interface ProgramChoice {
  id: number;
  title_ko: string;
}

interface OptionTableProps {
  options: FormOption[];
  programs: ProgramChoice[];
  /** 수업 연결·정원·학비 코스 칸을 보일지 (등록 기간에는 필요 없다) */
  showClassColumns: boolean;
  locked: boolean;
  onPatch: (optionKey: string, patch: Partial<FormOption>) => void;
  onMove: (optionKey: string, direction: -1 | 1) => void;
  onAdd: (labelKo: string) => void;
}

export default function OptionTable({
  options,
  programs,
  showClassColumns,
  locked,
  onPatch,
  onMove,
  onAdd,
}: OptionTableProps) {
  const [newLabel, setNewLabel] = useState('');

  function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    onAdd(label);
    setNewLabel('');
  }

  return (
    <div className="opt-table">
      {options.map((o, i) => (
        <div key={o.key} className={`opt-row${o.retired ? ' is-retired' : ''}`}>
          <div className="opt-row-head">
            <span className="opt-row-order">
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-outline"
                onClick={() => onMove(o.key, -1)}
                disabled={i === 0}
                aria-label="위로"
              >
                ↑
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-outline"
                onClick={() => onMove(o.key, 1)}
                disabled={i === options.length - 1}
                aria-label="아래로"
              >
                ↓
              </button>
            </span>

            <label className="opt-toggle">
              <input
                type="checkbox"
                checked={!o.retired}
                onChange={(e) => onPatch(o.key, { retired: !e.target.checked })}
              />
              <span>{o.retired ? '사용 안 함' : '사용'}</span>
            </label>

            <code className="opt-key">{o.key}</code>
          </div>

          <div className="opt-row-fields">
            <div className="admin-field">
              <label htmlFor={`opt-ko-${o.key}`}>한국어</label>
              <input
                id={`opt-ko-${o.key}`}
                type="text"
                value={o.label.ko}
                onChange={(e) => onPatch(o.key, { label: { ...o.label, ko: e.target.value } })}
              />
            </div>
            <div className="admin-field">
              <label htmlFor={`opt-en-${o.key}`}>English</label>
              <input
                id={`opt-en-${o.key}`}
                type="text"
                value={o.label.en ?? ''}
                onChange={(e) => onPatch(o.key, { label: { ...o.label, en: e.target.value } })}
              />
            </div>

            {showClassColumns && (
              <>
                <div className="admin-field">
                  <label htmlFor={`opt-prog-${o.key}`}>연결된 수업</label>
                  <select
                    id={`opt-prog-${o.key}`}
                    value={o.programId ?? ''}
                    onChange={(e) =>
                      onPatch(o.key, {
                        programId: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  >
                    <option value="">— 연결 안 함 —</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title_ko}
                      </option>
                    ))}
                  </select>
                  {o.programId == null && !o.retired && (
                    <p className="admin-field-help opt-warn">
                      연결하지 않으면 이 과목 신청자를 수업 명단에 넣을 수 없습니다.
                    </p>
                  )}
                </div>

                <div className="admin-field opt-field-narrow">
                  <label htmlFor={`opt-cap-${o.key}`}>정원</label>
                  <input
                    id={`opt-cap-${o.key}`}
                    type="text"
                    inputMode="numeric"
                    value={o.capacity ?? ''}
                    placeholder="미지정"
                    onChange={(e) => {
                      const n = e.target.value.replace(/\D/g, '');
                      onPatch(o.key, { capacity: n ? Number(n) : undefined });
                    }}
                  />
                </div>

                <div className="admin-field opt-field-narrow">
                  <label htmlFor={`opt-course-${o.key}`}>학비표 코스</label>
                  <input
                    id={`opt-course-${o.key}`}
                    type="text"
                    value={o.courseCode ?? ''}
                    placeholder="미지정"
                    onChange={(e) => onPatch(o.key, { courseCode: e.target.value || undefined })}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ))}

      <div className="opt-add">
        <div className="admin-field">
          <label htmlFor="opt-new">새 항목 추가</label>
          <input
            id="opt-new"
            type="text"
            value={newLabel}
            placeholder="한국어 이름을 적고 추가를 누르세요"
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={handleAdd}
          disabled={!newLabel.trim()}
        >
          추가
        </button>
      </div>

      {locked && (
        <p className="admin-field-help">
          이미 제출된 응답이 있어 항목을 지울 수 없습니다. 더 이상 받지 않으려면{' '}
          <strong>‘사용 안 함’</strong>으로 바꾸세요 — 새 신청자에게는 보이지 않고, 이미 낸 분들의
          기록은 그대로 남습니다.
        </p>
      )}
    </div>
  );
}
