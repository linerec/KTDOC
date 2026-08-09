'use client';

/**
 * QnaBrowser Component
 * Q&A 열람(원생·학부모·선생님) — 공통 안내 + 공연별 그룹 아코디언 + 검색
 */

import { useMemo, useState } from 'react';
import { useT, type TFunction } from '@/lib/i18n/useT';
import Link from 'next/link';
import type { FaqItem } from '@/types/faq';

interface QnaBrowserProps {
  items: FaqItem[];
}

interface QnaGroup {
  key: string;
  /** null = 공통 그룹 */
  eventId: number | null;
  title: string;
  items: FaqItem[];
}

function buildGroups(items: FaqItem[], t: TFunction): QnaGroup[] {
  const groups: QnaGroup[] = [];
  const byKey = new Map<string, QnaGroup>();
  // getFaqItems가 공통 → 공연(행사일 최신순), 그룹 내 sort_order 순으로 이미 정렬해서 내려준다
  for (const item of items) {
    const key = item.event_id === null ? 'general' : `event-${item.event_id}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        eventId: item.event_id,
        title:
          item.event_id === null
            ? t('admin.qna.generalGroup', '공통 안내')
            : `${item.event_title_ko ?? t('admin.schedule.typePerformance', '공연')} (${item.event_year ?? ''})`,
        items: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export default function QnaBrowser({ items }: QnaBrowserProps) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? items.filter(
          (i) =>
            i.question.toLowerCase().includes(term) ||
            i.answer.toLowerCase().includes(term) ||
            (i.event_title_ko ?? '').toLowerCase().includes(term)
        )
      : items;
    return buildGroups(filtered, t);
  }, [items, search, t]);

  if (items.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>
          {t(
            'admin.qna.empty',
            '아직 등록된 Q&A가 없습니다. 준비되는 대로 이곳에서 안내해 드리겠습니다.'
          )}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="qna-search">
        <input
          type="search"
          className="admin-filter-input"
          placeholder={t('admin.qna.searchPlaceholder', '질문·답변 검색...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('admin.qna.searchAria', 'Q&A 검색')}
        />
      </div>

      {groups.length === 0 ? (
        <div className="admin-empty-state">
          <p>{t('admin.qna.noResults', '검색 결과가 없습니다. 다른 단어로 검색해 보세요.')}</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="qna-group">
            <h2 className="qna-group-title">
              {group.eventId === null ? (
                group.title
              ) : (
                <Link href={`/admin/library/${group.eventId}`} className="qna-group-link">
                  {group.title}
                  <span className="qna-group-link-hint">{t('admin.qna.viewEvent', '공연 보기')} →</span>
                </Link>
              )}
            </h2>
            <div className="qna-list">
              {group.items.map((item) => {
                const open = openId === item.id;
                return (
                  <div key={item.id} className={`qna-item${open ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="qna-question"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : item.id)}
                    >
                      <span className="qna-q-mark" aria-hidden="true">Q</span>
                      <span className="qna-question-text">{item.question}</span>
                      <span className="qna-toggle" aria-hidden="true">{open ? '−' : '+'}</span>
                    </button>
                    {open && (
                      <div className="qna-answer">
                        <span className="qna-a-mark" aria-hidden="true">A</span>
                        <p className="qna-answer-text">{item.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </>
  );
}
