'use client';

/**
 * GlossaryBrowser (말모이)
 * 공개 용어 사전 + 노래(노랫말)의 검색·필터 UI. 전량을 서버에서 받아 클라이언트에서 필터한다.
 *
 * IA(정보구조): 두 개의 서로 다른 축을 명확히 분리한다.
 *   1) 콘텐츠 타입 — 전체 / 용어 / 노래 (세그먼트 탭, 최상위 축)
 *   2) 분류(카테고리) — '용어' 안에서만 쓰는 하위 필터
 *   → '전체'는 말 그대로 용어와 노래를 모두 보여준다(각 섹션 헤더로 구분).
 *     '노래'는 분류가 아니라 별개의 콘텐츠 타입이므로 카테고리 칩과 섞지 않는다.
 *
 * 용어: 한글·영문·로마자·발음·뜻을 매칭 → 미국 학생이 로마자("chumsawi")나 발음("choom")으로도 찾는다.
 * 노래: 별달거리처럼 가사를 줄별 한국어/발음/영어로 정렬해 따라 부르며 발음까지 연습한다.
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

type ViewType = 'all' | 'terms' | 'songs';

function matchTerm(term: GlossaryTermWithCategory, q: string) {
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
}

function matchSong(song: GlossarySongWithLines, q: string) {
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
}

export default function GlossaryBrowser({ terms, categories, songs }: Props) {
  const { locale, messages } = useLanguage();
  const isKorean = locale === 'ko';
  const t = (key: string, fallback: string) => messages[key] || fallback;

  const hasSongs = songs.length > 0;

  const [search, setSearch] = useState('');
  // 콘텐츠 타입(최상위 축). 노래가 없으면 타입 개념 자체가 불필요 → 항상 '용어'로 고정.
  const [view, setView] = useState<ViewType>(hasSongs ? 'all' : 'terms');
  // 분류 하위 필터. null = 전체 분류. '용어' 뷰에서만 의미가 있다.
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [openSongId, setOpenSongId] = useState<number | null>(null);

  const q = search.trim().toLowerCase();

  const termMatches = useMemo(() => terms.filter((term) => matchTerm(term, q)), [terms, q]);
  const songMatches = useMemo(() => songs.filter((song) => matchSong(song, q)), [songs, q]);

  const countByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const term of terms) {
      if (term.category_id != null) map.set(term.category_id, (map.get(term.category_id) ?? 0) + 1);
    }
    return map;
  }, [terms]);

  const catName = (c: GlossaryCategory) => (isKorean ? c.name_ko : c.name_en || c.name_ko);

  // 검색어가 있으면 노래 타입에도 자동으로 반영되도록: '용어' 뷰에서 검색해 용어가 0개인데
  // 노래에 매칭이 있으면 사용자가 놓치지 않게 '전체'로 넓혀 안내한다(하단 result-info에서 처리).

  // 용어 그룹: '전체' 뷰에서 분류별 소제목으로 나눠 구조를 드러낸다.
  const termGroups = useMemo(() => {
    const groups: { key: string; label: string; items: GlossaryTermWithCategory[] }[] = [];
    for (const c of categories) {
      const items = termMatches.filter((term) => term.category_id === c.id);
      if (items.length > 0) groups.push({ key: `c${c.id}`, label: catName(c), items });
    }
    const known = new Set(categories.map((c) => c.id));
    const rest = termMatches.filter((term) => term.category_id == null || !known.has(term.category_id));
    if (rest.length > 0) {
      groups.push({ key: 'uncat', label: t('glossary.section.other', '기타'), items: rest });
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termMatches, categories, isKorean, messages]);

  // '용어' 뷰에서 카테고리 하위 필터 적용
  const termsInTermsView = useMemo(() => {
    if (categoryId == null) return termMatches;
    return termMatches.filter((term) => term.category_id === categoryId);
  }, [termMatches, categoryId]);

  // ── 렌더 헬퍼 ─────────────────────────────────────────────
  const renderTermCard = (term: GlossaryTermWithCategory, showCat: boolean) => {
    const definition = isKorean
      ? term.definition_ko || term.definition_en
      : term.definition_en || term.definition_ko;
    const example = isKorean
      ? term.example_ko || term.example_en
      : term.example_en || term.example_ko;
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
              {term.romanization && <span className="glossary-pron-roman">{term.romanization}</span>}
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

        {showCat && term.category_name_ko && (
          <span className="glossary-item-cat">
            {isKorean ? term.category_name_ko : term.category_name_en || term.category_name_ko}
          </span>
        )}
      </li>
    );
  };

  const renderSongCard = (song: GlossarySongWithLines) => {
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
            <span className="song-card-toggle" aria-hidden="true">
              {open ? '−' : '+'}
            </span>
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
              <a
                href={song.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="song-listen-link"
              >
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
  };

  const sectionLabelTerms = t('glossary.section.terms', '용어');
  const sectionLabelSongs = t('glossary.section.songs', '노래·노랫말');

  const showTermSection = view === 'all' || view === 'terms';
  const showSongSection = hasSongs && (view === 'all' || view === 'songs');

  // 결과 안내 문구
  const nTerms = view === 'terms' ? termsInTermsView.length : termMatches.length;
  const nSongs = songMatches.length;
  const nothingVisible =
    (showTermSection ? (view === 'terms' ? termsInTermsView.length : termMatches.length) : 0) === 0 &&
    (showSongSection ? nSongs : 0) === 0;

  return (
    <div className="glossary-browser">
      <div className="glossary-search">
        <input
          type="search"
          className="glossary-search-input"
          placeholder={t(
            'glossary.search.placeholder',
            '용어, 발음, 뜻으로 검색…  (Search by term, sound, or meaning)',
          )}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('glossary.search.label', '용어 검색')}
        />
      </div>

      {/* 1차 축 — 콘텐츠 타입 (노래가 있을 때만 노출) */}
      {hasSongs && (
        <div className="glossary-tabs" role="tablist" aria-label={t('glossary.view.label', '보기')}>
          <button
            type="button"
            className={`glossary-tab${view === 'all' ? ' is-active' : ''}`}
            onClick={() => setView('all')}
            role="tab"
            aria-selected={view === 'all'}
          >
            {t('glossary.view.all', '전체')}
          </button>
          <button
            type="button"
            className={`glossary-tab${view === 'terms' ? ' is-active' : ''}`}
            onClick={() => setView('terms')}
            role="tab"
            aria-selected={view === 'terms'}
          >
            {t('glossary.view.terms', '용어')}
            <span className="glossary-tab-count">{terms.length}</span>
          </button>
          <button
            type="button"
            className={`glossary-tab${view === 'songs' ? ' is-active' : ''}`}
            onClick={() => setView('songs')}
            role="tab"
            aria-selected={view === 'songs'}
          >
            ♪ {t('glossary.view.songs', '노래')}
            <span className="glossary-tab-count">{songs.length}</span>
          </button>
        </div>
      )}

      {/* 2차 축 — 분류(카테고리): '용어' 뷰의 하위 필터로만 노출 */}
      {view === 'terms' && categories.length > 0 && (
        <div
          className="glossary-filters"
          role="tablist"
          aria-label={t('glossary.filter.label', '분류')}
        >
          <button
            type="button"
            className={`glossary-chip${categoryId == null ? ' is-active' : ''}`}
            onClick={() => setCategoryId(null)}
            role="tab"
            aria-selected={categoryId == null}
          >
            {t('glossary.filter.allCategories', '전체 분류')}
            <span className="glossary-chip-count">{terms.length}</span>
          </button>
          {categories.map((c) => {
            const count = countByCategory.get(c.id) ?? 0;
            if (count === 0) return null;
            return (
              <button
                type="button"
                key={c.id}
                className={`glossary-chip${categoryId === c.id ? ' is-active' : ''}`}
                onClick={() => setCategoryId(c.id)}
                role="tab"
                aria-selected={categoryId === c.id}
              >
                {catName(c)}
                <span className="glossary-chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 검색 결과 안내 */}
      {q && (
        <p className="glossary-result-info">
          {view === 'songs'
            ? `${nSongs}${isKorean ? '개 노래' : ' songs'}`
            : hasSongs && view === 'all'
              ? `${isKorean ? '용어' : 'Terms'} ${nTerms} · ${isKorean ? '노래' : 'Songs'} ${nSongs}`
              : `${nTerms}${isKorean ? '개 표시 중' : ' shown'}`}
        </p>
      )}

      {nothingVisible ? (
        <p className="glossary-empty">
          {t('glossary.empty', '검색 결과가 없습니다. 다른 단어로 찾아보세요.')}
        </p>
      ) : (
        <div className="glossary-sections">
          {/* ── 용어 섹션 ── */}
          {showTermSection &&
            (view === 'all' ? (
              termGroups.length > 0 && (
                <section className="glossary-section">
                  <h2 className="glossary-section-head">
                    <span className="glossary-section-title">{sectionLabelTerms}</span>
                    <span className="glossary-section-count">{termMatches.length}</span>
                  </h2>
                  {termGroups.map((g) => (
                    <div key={g.key} className="glossary-group">
                      {termGroups.length > 1 && <h3 className="glossary-group-head">{g.label}</h3>}
                      <ul className="glossary-list">
                        {g.items.map((term) => renderTermCard(term, false))}
                      </ul>
                    </div>
                  ))}
                </section>
              )
            ) : termsInTermsView.length > 0 ? (
              <section className="glossary-section">
                <ul className="glossary-list">
                  {termsInTermsView.map((term) => renderTermCard(term, categoryId == null))}
                </ul>
              </section>
            ) : (
              <p className="glossary-empty">
                {t('glossary.empty', '검색 결과가 없습니다. 다른 단어로 찾아보세요.')}
              </p>
            ))}

          {/* ── 노래 섹션 ── */}
          {showSongSection && songMatches.length > 0 && (
            <section className="glossary-section glossary-section-songs">
              {view === 'all' && (
                <h2 className="glossary-section-head">
                  <span className="glossary-section-title">
                    <span className="glossary-section-note" aria-hidden="true">
                      ♪{' '}
                    </span>
                    {sectionLabelSongs}
                  </span>
                  <span className="glossary-section-count">{songMatches.length}</span>
                </h2>
              )}
              <ul className="song-list">{songMatches.map((song) => renderSongCard(song))}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
