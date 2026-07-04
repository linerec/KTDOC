'use client';

/**
 * GlossaryBrowser (말모이)
 * 공개 용어 사전의 검색·필터 UI. 전량을 서버에서 받아 클라이언트 메모리에서 필터한다
 * (수강생 아카이브처럼 데이터 규모가 작아 실시간 검색에 적합).
 *
 * 검색은 한글 용어·영문 의미·로마자·발음·뜻을 모두 매칭하므로,
 * 미국 학생이 로마자("chumsawi")나 발음("choom")으로도 찾을 수 있다.
 */

import { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GlossaryTermWithCategory, GlossaryCategory } from '@/types/glossary';

interface Props {
  terms: GlossaryTermWithCategory[];
  categories: GlossaryCategory[];
}

export default function GlossaryBrowser({ terms, categories }: Props) {
  const { locale, messages } = useLanguage();
  const isKorean = locale === 'ko';
  const t = (key: string, fallback: string) => messages[key] || fallback;

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return terms.filter((term) => {
      if (activeCategory !== 'all' && term.category_id !== activeCategory) return false;
      if (!q) return true;
      const haystack = [
        term.term_ko,
        term.term_en,
        term.romanization,
        term.pronunciation,
        term.definition_ko,
        term.definition_en,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [terms, search, activeCategory]);

  // 분류별 용어 수(필터 칩 배지). 전체 목록 기준(검색과 무관하게 안정적).
  const countByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const term of terms) {
      if (term.category_id != null) {
        map.set(term.category_id, (map.get(term.category_id) ?? 0) + 1);
      }
    }
    return map;
  }, [terms]);

  const catName = (c: GlossaryCategory) => (isKorean ? c.name_ko : c.name_en || c.name_ko);

  return (
    <div className="glossary-browser">
      <div className="glossary-search">
        <input
          type="search"
          className="glossary-search-input"
          placeholder={t('glossary.search.placeholder', '용어, 발음, 뜻으로 검색…  (Search by term, sound, or meaning)')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('glossary.search.label', '용어 검색')}
        />
      </div>

      <div className="glossary-filters" role="tablist" aria-label={t('glossary.filter.label', '분류')}>
        <button
          type="button"
          className={`glossary-chip${activeCategory === 'all' ? ' is-active' : ''}`}
          onClick={() => setActiveCategory('all')}
          role="tab"
          aria-selected={activeCategory === 'all'}
        >
          {t('glossary.filter.all', '전체')}
          <span className="glossary-chip-count">{terms.length}</span>
        </button>
        {categories.map((c) => {
          const count = countByCategory.get(c.id) ?? 0;
          if (count === 0) return null;
          return (
            <button
              type="button"
              key={c.id}
              className={`glossary-chip${activeCategory === c.id ? ' is-active' : ''}`}
              onClick={() => setActiveCategory(c.id)}
              role="tab"
              aria-selected={activeCategory === c.id}
            >
              {catName(c)}
              <span className="glossary-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      <p className="glossary-result-info">
        {filtered.length === terms.length
          ? t('glossary.count.total', `총 ${terms.length}개 용어`).replace('{n}', String(terms.length))
          : t('glossary.count.filtered', `${filtered.length}개 표시 중`).replace('{n}', String(filtered.length))}
      </p>

      {filtered.length === 0 ? (
        <p className="glossary-empty">
          {t('glossary.empty', '검색 결과가 없습니다. 다른 단어로 찾아보세요.')}
        </p>
      ) : (
        <ul className="glossary-list">
          {filtered.map((term) => {
            const definition = isKorean
              ? term.definition_ko || term.definition_en
              : term.definition_en || term.definition_ko;
            const example = isKorean
              ? term.example_ko || term.example_en
              : term.example_en || term.example_ko;
            // 한글 용어(term_ko)를 배우는 것이 목적이므로 항상 제목으로 크게,
            // 영문 의미(term_en)는 보조로 함께 보여준다.
            return (
              <li key={term.id} className="glossary-item">
                <div className="glossary-item-head">
                  <h3 className="glossary-term">
                    <span className="glossary-term-ko">{term.term_ko}</span>
                    {term.term_en && <span className="glossary-term-meaning">{term.term_en}</span>}
                  </h3>
                  {(term.pronunciation || term.romanization) && (
                    <div className="glossary-pron">
                      {term.pronunciation && (
                        <span className="glossary-pron-say" aria-label="pronunciation">
                          /&nbsp;{term.pronunciation}&nbsp;/
                        </span>
                      )}
                      {term.romanization && (
                        <span className="glossary-pron-roman">{term.romanization}</span>
                      )}
                    </div>
                  )}
                </div>

                {definition && <p className="glossary-def">{definition}</p>}

                {example && (
                  <p className="glossary-example">
                    <span className="glossary-example-mark">“</span>
                    {example}
                    <span className="glossary-example-mark">”</span>
                  </p>
                )}

                {term.category_name_ko && (
                  <span className="glossary-item-cat">
                    {isKorean
                      ? term.category_name_ko
                      : term.category_name_en || term.category_name_ko}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
