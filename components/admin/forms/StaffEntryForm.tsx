'use client';

/**
 * StaffEntryForm — 대리 입력의 맥락 + 신청서 본체
 *
 * 폼 자체는 공개 렌더러를 그대로 쓴다(운영진이 학부모가 보는 화면을 봐야 문항을
 * 헷갈리지 않는다). 이 컴포넌트가 더하는 것은 폼 밖에서 정해지는 두 가지다:
 *
 *   1) **누구의 신청인가** — 전화를 받은 사람은 그 자리에서 안다. 나중에 상세
 *      화면에서 다시 찾게 하지 않는다. 고르면 빈 칸(이름·이메일·연락처)이 채워지고,
 *      제출과 동시에 회원 연결까지 끝난다 → 바로 수업에 넣을 수 있다.
 *   2) **어디로 받았는가** — 전화·카톡·종이. 나중에 "이건 누가 넣었죠?"를
 *      답하는 것이 이 기록이다.
 *
 * 학부모로 찾은 경우 **자녀로 건너뛰게** 한다. 학부모 계정을 그대로 이으면
 * 나중에 학부모가 수업 명단에 들어간다 — 실제로 조심해야 하는 자리다.
 */

import { useMemo, useState } from 'react';
import FormRenderer from '@/components/forms/FormRenderer';
import {
  ENTRY_CHANNELS,
  ENTRY_CHANNEL_LABEL,
  relaxSchemaForStaffEntry,
  type EntryChannel,
} from '@/lib/forms/staffEntry';
import {
  MEMBER_ROLE_LABELS,
  MEMBER_SEARCH_MIN,
  MEMBER_STATUS_LABELS,
  type LinkableMember,
} from '@/types/members';
import type { Answers, CoreBindKey, FormSchema } from '@/types/forms';

/** 고른 사람 — 응답에 이을 회원과, 폼의 빈 칸을 채울 값. */
interface Picked {
  userId: string;
  label: string;
  sub: string;
  fill: Partial<Record<CoreBindKey, string>>;
  /** 이대로 이으면 곤란해지는 경우에만 있다. */
  warn?: string;
  /**
   * 경고와 함께 내놓는 **바로 고칠 길**. 학부모를 골랐을 때 그 자녀들이 들어온다 —
   * "자녀를 골라 주세요"라고만 하고 고를 곳을 치워 버리면 안내가 막다른 길이 된다.
   */
  switchTo?: { parent: LinkableMember; children: { id: string; name: string }[] };
}

interface Props {
  formId: number;
  slug: string;
  schema: FormSchema;
}

export default function StaffEntryForm({ formId, slug, schema }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<LinkableMember[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);

  const [channel, setChannel] = useState<EntryChannel>('phone');
  const [memo, setMemo] = useState('');

  /**
   * 화면이 쓰는 스키마 — 이메일 필수를 내린 것. 서버가 비워도 받아 주는데
   * 버튼이 막으면 위의 안내문이 거짓말이 된다.
   */
  const entrySchema = useMemo(() => relaxSchemaForStaffEntry(schema), [schema]);

  /** bind → 문항 키. 채울 칸을 스키마에 물어본다(문항 키를 외우지 않는다). */
  const bindKeys = useMemo(() => {
    const map: Partial<Record<CoreBindKey, string>> = {};
    for (const section of schema.sections) {
      for (const q of section.questions) {
        if (q.bind && !q.retired && !map[q.bind]) map[q.bind] = q.key;
      }
    }
    return map;
  }, [schema]);

  /**
   * 고른 회원의 값을 문항 키로 옮긴다. 렌더러는 **빈 칸만** 채우므로
   * 이미 받아 적은 답을 지우지 않는다.
   */
  const prefillValues = useMemo<Answers>(() => {
    if (!picked) return {};
    const values: Answers = {};
    for (const [bind, value] of Object.entries(picked.fill)) {
      const key = bindKeys[bind as CoreBindKey];
      if (key && value) values[key] = value;
    }
    return values;
  }, [picked, bindKeys]);

  const prefill = useMemo(
    () => (picked ? { values: prefillValues } : undefined),
    [picked, prefillValues]
  );

  async function search() {
    const term = query.trim();
    if (term.length < MEMBER_SEARCH_MIN) {
      setSearchError(`${MEMBER_SEARCH_MIN}글자 이상 입력해 주세요.`);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/admin/forms/${formId}/member-search?q=${encodeURIComponent(term)}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSearchError(json.error ?? '검색하지 못했습니다.');
        return;
      }
      setHits(json.data.members ?? []);
    } catch {
      setSearchError('연결이 끊어졌습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSearching(false);
    }
  }

  /** 회원 본인의 신청으로 잇는다. */
  function pickMember(m: LinkableMember) {
    const name = m.name ?? '';
    const kids = m.children ?? [];
    const isParent = m.role === 'parent';
    setPicked({
      userId: m.id,
      label: name || m.email,
      sub: `${m.email} · ${MEMBER_ROLE_LABELS[m.role]} · ${MEMBER_STATUS_LABELS[m.status]}`,
      fill: isParent
        ? { guardian_name: name, email: m.email, phone: m.phone ?? '' }
        : { student_name: name, email: m.email, phone: m.phone ?? '' },
      warn: !isParent
        ? undefined
        : kids.length > 0
          ? '학부모 계정입니다. 이대로 두면 수업 명단에 학부모가 들어갑니다 — 실제로 배울 자녀를 골라 주세요.'
          : '학부모 계정입니다. 이대로 두면 수업 명단에 학부모가 들어갑니다. 연결된 자녀가 없으니, 자녀 이름으로 다시 찾거나 비워 둔 채 접수해 주세요.',
      switchTo: isParent && kids.length > 0 ? { parent: m, children: kids } : undefined,
    });
    setHits(null);
  }

  /** 학부모로 찾았을 때, 실제 신청 대상인 자녀로 잇는다. 연락처는 학부모 것을 쓴다. */
  function pickChild(parent: LinkableMember, child: { id: string; name: string }) {
    setPicked({
      userId: child.id,
      label: child.name,
      sub: `${parent.name ?? parent.email} 님의 자녀 · 연락처는 보호자 것으로 채웠습니다`,
      fill: {
        student_name: child.name,
        guardian_name: parent.name ?? '',
        email: parent.email,
        phone: parent.phone ?? '',
      },
    });
    setHits(null);
  }

  return (
    <>
      <section className="admin-card staff-entry-context">
        {/* ── 누구의 신청인가 ── */}
        <div className="staff-entry-block">
          <h2 className="staff-entry-title">누구의 신청인가요?</h2>
          <p className="admin-field-help">
            회원을 고르면 이름·연락처가 채워지고, 접수와 동시에 그 회원에게 연결됩니다 —
            바로 수업 명단에 넣을 수 있습니다. 아직 가입 전이라면 <strong>비워 두셔도
            됩니다.</strong> 나중에 신청 상세에서 연결할 수 있습니다.
          </p>

          {picked ? (
            <div className="staff-entry-picked">
              <div>
                <strong>{picked.label}</strong>
                <span className="admin-cell-sub">{picked.sub}</span>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-outline"
                onClick={() => setPicked(null)}
              >
                연결 해제
              </button>
            </div>
          ) : (
            <div className="opt-add">
              <div className="admin-field">
                <label htmlFor="se-q">이름 또는 이메일로 찾기</label>
                <input
                  id="se-q"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      search();
                    }
                  }}
                />
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={search}
                disabled={searching}
              >
                {searching ? '찾는 중…' : '찾기'}
              </button>
            </div>
          )}

          {picked?.warn && (
            <div className="admin-alert admin-alert-error staff-entry-warn" role="status">
              <p>{picked.warn}</p>
              {picked.switchTo && (
                <span className="staff-entry-children">
                  {picked.switchTo.children.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="staff-entry-child"
                      onClick={() => pickChild(picked.switchTo!.parent, c)}
                    >
                      자녀 · {c.name}
                    </button>
                  ))}
                </span>
              )}
            </div>
          )}

          {searchError && <p className="form-error">{searchError}</p>}

          {!picked && hits !== null && (
            <div className="resp-hits">
              {hits.length === 0 ? (
                <p className="admin-field-help">
                  찾은 회원이 없습니다. 아직 가입 전일 수 있습니다 — 비워 둔 채로 접수하고,
                  가입하신 뒤에 신청 상세에서 연결해 주세요.
                </p>
              ) : (
                hits.map((m) => (
                  <div key={m.id} className="resp-hit staff-entry-hit">
                    <span>
                      <strong>{m.name ?? '(이름 없음)'}</strong>
                      <span className="admin-cell-sub">
                        {m.email} · {MEMBER_ROLE_LABELS[m.role]} ·{' '}
                        {MEMBER_STATUS_LABELS[m.status]}
                      </span>
                      {/* 학부모로 찾았을 때 실제 신청 대상은 대개 자녀다 */}
                      {(m.children ?? []).length > 0 && (
                        <span className="staff-entry-children">
                          {(m.children ?? []).map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="staff-entry-child"
                              onClick={() => pickChild(m, c)}
                            >
                              자녀 · {c.name}
                            </button>
                          ))}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-outline"
                      onClick={() => pickMember(m)}
                    >
                      본인 신청
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── 어디로 받았는가 ── */}
        <div className="staff-entry-block">
          <h2 className="staff-entry-title">어떻게 받으셨나요?</h2>
          <p className="admin-field-help">
            처리 이력에 남습니다. 나중에 이 신청을 두고 이야기가 오갈 때 근거가 됩니다.
          </p>
          <div className="staff-entry-channel">
            {ENTRY_CHANNELS.map((c) => (
              <label key={c} className={`staff-entry-chip ${channel === c ? 'is-on' : ''}`}>
                <input
                  type="radio"
                  name="staff-entry-channel"
                  value={c}
                  checked={channel === c}
                  onChange={() => setChannel(c)}
                />
                {ENTRY_CHANNEL_LABEL[c]}
              </label>
            ))}
          </div>
          <div className="admin-field">
            <label htmlFor="se-memo">메모 (선택)</label>
            <textarea
              id="se-memo"
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="통화에서 나온 이야기 — 형제 함께 신청, 학비 문의 등"
            />
          </div>
        </div>
      </section>

      <div className="admin-card staff-entry">
        <FormRenderer
          slug={slug}
          schema={entrySchema}
          prefill={prefill}
          submitTo={`/api/admin/forms/${formId}/responses`}
          doneHref={`/admin/forms/${formId}/responses/{id}`}
          submitLabel="이 내용으로 접수하기"
          extraPayload={{
            studentUserId: picked?.userId,
            channel,
            memo: memo.trim() || undefined,
          }}
        />
      </div>
    </>
  );
}
