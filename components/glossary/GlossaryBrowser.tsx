'use client';

/**
 * GlossaryBrowser (말모이)
 * 공개 용어 사전 + 노래(노랫말)의 검색·필터 UI. 전량을 서버에서 받아 클라이언트에서 필터한다.
 *
 * 용어 탭: 한글·영문·로마자·발음·뜻을 매칭 → 미국 학생이 로마자("chumsawi")나 발음("choom")으로도 찾는다.
 * 노래 탭: 별달거리처럼 가사를 줄별 한국어/발음/영어로 정렬해 따라 부르며 발음까지 연습한다.
 */

import { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { extractYouTubeId } from '@/types/gallery';
import type {
  GlossaryTermWithCategory,
  GlossaryCategory,
  GlossarySongWithLines,
} from '@/types/glossary';

interface Props {
  terms: GlossaryTermWithCategory[];
  categories: GlossaryCategory[];
  songs: GlossarySongWithLines[];
}

type Tab = 'all' | number | 'songs';

export default function GlossaryBrowser({ terms, categories, songs }: Props) {
  const { locale, messages } = useLanguage();
  const isKorean = locale === 'ko';
  const t = (key: string, fallback: string) => messages[key] || fallback;

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [openSongId, setOpenSongId] = useState<number | null>(null);

  const q = search.trim().toLowerCase();

  const filteredTerms = useMemo(() => {
    if (activeTab === 'songs') return [];
    return terms.filter((term) => {
      if (typeof activeTab === 'number' && term.category_id !== activeTab) return false;
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
  }, [terms, q, activeTab]);

  const filteredSongs = useMemo(() => {
    if (activeTab !== 'songs') return [];
    return songs.filter((song) => {
      if (!q) return true;
      const haystack = [
        song.title_ko,
        song.title_en,
        song.romanization,
        song.pronunciation,
        ...song.lines.flatMap((l) => [l.text_ko, l.pronunciation, l.text_en]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [songs, q, activeTab]);

  const countByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const term of terms) {
      if (term.category_id != null) map.set(term.category_id, (map.get(term.category_id) ?? 0) + 1);
    }
    return map;
  }, [terms]);

  const catName = (c: GlossaryCategory) => (isKorean ? c.name_ko : c.name_en || c.name_ko);
  const resultCount = activeTab === 'songs' ? filteredSongs.length : filteredTerms.length;

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
          className={`glossary-chip${activeTab === 'all' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('all')}
          role="tab"
          aria-selected={activeTab === 'all'}
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
              className={`glossary-chip${activeTab === c.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(c.id)}
              role="tab"
              aria-selected={activeTab === c.id}
            >
              {catName(c)}
              <span className="glossary-chip-count">{count}</span>
            </button>
          );
        })}
        {songs.length > 0 && (
          <button
            type="button"
            className={`glossary-chip glossary-chip-songs${activeTab === 'songs' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('songs')}
            role="tab"
            aria-selected={activeTab === 'songs'}
          >
            ♪ {t('glossary.filter.songs', '노래')}
            <span className="glossary-chip-count">{songs.length}</span>
          </button>
        )}
      </div>

      <p className="glossary-result-info">
        {t('glossary.count.showing', `${resultCount}개 표시 중`).replace('{n}', String(resultCount))}
      </p>

      {/* 노래 탭 */}
      {activeTab === 'songs' ? (
        filteredSongs.length === 0 ? (
          <p className="glossary-empty">{t('glossary.empty', '검색 결과가 없습니다. 다른 단어로 찾아보세요.')}</p>
        ) : (
          <ul className="song-list">
            {filteredSongs.map((song) => {
              const open = openSongId === song.id;
              const ytId = song.youtube_url ? extractYouTubeId(song.youtube_url) : null;
              const description = isKorean
                ? song.description_ko || song.description_en
                : song.description_en || song.description_ko;
              return (
                <li key={song.id} className={`song-card${open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="song-card-head"
                    onClick={() => setOpenSongId(open ? null : song.id)}
                    aria-expanded={open}
                  >
                    <span className="song-card-titles">
                      <span className="song-card-title">{song.title_ko}</span>
                      {song.title_en && <span className="song-card-title-en">{song.title_en}</span>}
                    </span>
                    <span className="song-card-meta">
                      {song.pronunciation && <span className="song-card-pron">/ {song.pronunciation} /</span>}
                      <span className="song-card-toggle" aria-hidden="true">{open ? '−' : '+'}</span>
                    </span>
                  </button>

                  {open && (
                    <div className="song-card-body">
                      {description && <p className="song-desc">{description}</p>}

                      {ytId && (
                        <div className="song-video">
                          <iframe
                            src={`https://www.youtube.com/embed/${ytId}`}
                            title={song.title_ko}
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                      {!ytId && song.youtube_url && (
                        <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="song-listen-link">
                          ▶ {t('glossary.song.listen', '음원 듣기')}
                        </a>
                      )}

                      {song.lines.length > 0 && (
                        <div className="song-lyrics" role="table">
                          <div className="song-lyrics-head" role="row">
                            <span role="columnheader">{t('glossary.song.col.ko', '한국어')}</span>
                            <span role="columnheader">{t('glossary.song.col.say', '발음')}</span>
                            <span role="columnheader">{t('glossary.song.col.en', 'English')}</span>
                          </div>
                          {song.lines.map((line) => (
                            <div
                              key={line.id}
                              className={`song-lyrics-row${line.is_refrain ? ' is-refrain' : ''}`}
                              role="row"
                            >
                              <span className="song-ly-ko" role="cell">
                                {line.is_refrain && (
                                  <span className="song-refrain-tag">{t('glossary.song.refrain', '후렴')}</span>
                                )}
                                {line.text_ko}
                              </span>
                              <span className="song-ly-say" role="cell">
                                {line.pronunciation || line.romanization || ''}
                              </span>
                              <span className="song-ly-en" role="cell">
                                {line.text_en || ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : filteredTerms.length === 0 ? (
        <p className="glossary-empty">{t('glossary.empty', '검색 결과가 없습니다. 다른 단어로 찾아보세요.')}</p>
      ) : (
        <ul className="glossary-list">
          {filteredTerms.map((term) => {
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
