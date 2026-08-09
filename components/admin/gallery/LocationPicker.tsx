'use client';

/**
 * LocationPicker Component
 * 공연 위치 입력 — 장소명 + 주소 자동완성(지오코딩) + 지도 미리보기
 *
 * 주소 검색은 /api/admin/geocode(서버 프록시)를 거치므로 지도 제공자를 교체해도
 * 이 컴포넌트는 그대로다. 지도 미리보기는 lib/maps의 embedUrl(순수 함수)을 쓴다.
 */

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import { getMapsProvider, type GeocodeResult } from '@/lib/maps';

export interface LocationValue {
  /** 장소명 (예: "뉴저지 한인회관 대공연장") */
  location: string;
  /** 지오코딩된 전체 주소 */
  location_address: string;
  location_lat: number | null;
  location_lng: number | null;
  /** 수동 지도/길찾기 링크 — 비워두면 좌표로 자동 생성 */
  location_url: string;
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (patch: Partial<LocationValue>) => void;
}

const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const t = useT();
  const provider = getMapsProvider();

  // 검색 입력은 로컬 상태 — 확정(선택)된 주소만 부모(value.location_address)로 올린다
  const [query, setQuery] = useState(value.location_address);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  // 검색 실패는 문구가 아니라 '실패했다'는 사실만 담는다 — 문구는 그릴 때 번역한다.
  // (효과 안에서 t()를 부르면 언어를 바꿀 때마다 디바운스 검색이 다시 돌아 버린다.)
  const [searchFailed, setSearchFailed] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 선택 직후 발생하는 query 변경은 재검색하지 않는다
  const skipSearchRef = useRef(false);

  const hasCoords = value.location_lat !== null && value.location_lng !== null;

  // 부모가 주소를 외부에서 바꾸면(AI 채우기 등) 검색창도 따라간다.
  // 사용자가 타이핑하는 동안에는 value.location_address가 변하지 않으므로 간섭 없음.
  useEffect(() => {
    skipSearchRef.current = true;
    setQuery(value.location_address);
  }, [value.location_address]);

  // 바깥 클릭으로 제안 목록 닫기
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // 디바운스 검색
  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    // 사용자가 입력 중일 때만 검색 — 마운트 시(저장된 주소 초기값) 자동 검색 방지
    if (typeof document !== 'undefined' && document.activeElement !== inputRef.current) {
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setOpen(false);
      setSearching(false);
      return;
    }

    debounceRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      setSearchFailed(false);
      try {
        const res = await fetch(`/api/admin/geocode?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setResults(data.data);
        setOpen(true);
        setHighlight(-1);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setResults([]);
        setSearchFailed(true);
        setOpen(true);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const selectResult = (r: GeocodeResult) => {
    skipSearchRef.current = true;
    setQuery(r.address);
    setOpen(false);
    setResults([]);
    onChange({
      location_address: r.address,
      location_lat: r.lat,
      location_lng: r.lng,
      // 장소명이 비어 있으면 검색 결과의 이름으로 채워준다(수정 가능)
      ...(r.name && !value.location.trim() ? { location: r.name } : {}),
    });
  };

  /**
   * 입력창을 떠날 때, 제안을 고르지 않았어도 적은 주소를 저장한다.
   *
   * 예전에는 타이핑이 로컬 state에만 있어서 제안을 고르지 않으면 **조용히 버려졌다**.
   * 포스터에서 옮겨 적거나 AI가 뽑아 준 주소가 그런 경우인데, 정규화가 안 되는
   * 정도가 아니라 아예 저장이 안 됐다. 좌표는 비워 둔다 — 확인되지 않은 주소라는
   * 사실이 화면과 데이터 양쪽에 남아야 한다(지도도 좌표가 있어야만 뜬다).
   */
  const commitTypedAddress = () => {
    const typed = query.trim();
    if (typed === value.location_address) return;
    if (!typed) {
      onChange({ location_address: '', location_lat: null, location_lng: null });
      return;
    }
    onChange({ location_address: typed, location_lat: null, location_lng: null });
  };

  const clearCoords = () => {
    skipSearchRef.current = true;
    setQuery('');
    setResults([]);
    setOpen(false);
    onChange({ location_address: '', location_lat: null, location_lng: null });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? results.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      if (highlight >= 0) {
        e.preventDefault();
        selectResult(results[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="location-picker" ref={rootRef}>
      <div className="admin-form-group">
        <label htmlFor="location" className="admin-form-label">
          {t('admin.location.name', '장소명')}
        </label>
        <input
          type="text"
          id="location"
          value={value.location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder={t('admin.location.namePlaceholder', '예: 뉴저지 한인회관 대공연장')}
          className="admin-form-input"
        />
      </div>

      <div className="admin-form-group location-picker-search">
        <label htmlFor="location_address" className="admin-form-label">
          {t('admin.location.search', '주소 검색')}
        </label>
        <input
          ref={inputRef}
          type="text"
          id="location_address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          /* 제안 클릭은 onPointerDown에서 preventDefault로 blur를 막으므로
             여기 걸려도 선택 동작과 부딪히지 않는다. */
          onBlur={commitTypedAddress}
          placeholder={t(
            'admin.location.searchPlaceholder',
            '주소나 장소 이름을 입력해 검색 (예: 100 Grove St, Jersey City)'
          )}
          className="admin-form-input"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="location-suggestions"
        />
        {searching && (
          <span className="location-picker-status">
            {t('admin.location.searching', '검색 중…')}
          </span>
        )}

        {open && (
          <ul id="location-suggestions" className="location-picker-suggestions" role="listbox">
            {searchFailed && (
              <li className="location-picker-empty">
                {t('admin.location.searchFailed', '주소 검색에 실패했습니다. 잠시 후 다시 시도해주세요.')}
              </li>
            )}
            {!searchFailed && results.length === 0 && !searching && (
              <li className="location-picker-empty">
                {t('admin.location.noResults', '검색 결과가 없습니다. 영문 주소로 검색해보세요.')}
              </li>
            )}
            {results.map((r, i) => (
              <li
                key={`${r.lat},${r.lng},${i}`}
                role="option"
                aria-selected={i === highlight}
                className={`location-picker-suggestion${i === highlight ? ' is-highlighted' : ''}`}
                onPointerDown={(e) => {
                  // input blur보다 먼저 처리
                  e.preventDefault();
                  selectResult(r);
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                {r.name && <strong className="location-picker-suggestion-name">{r.name}</strong>}
                <span className="location-picker-suggestion-address">{r.address}</span>
                {/* 제공자가 "질의를 온전히 해석하지 못했다"고 알려 준 결과.
                    표시하지 않으면 정확한 결과와 구분되지 않는다. */}
                {r.approximate && (
                  <span className="location-picker-suggestion-approx">
                    {t('admin.location.approximate', '근사치 — 확인 필요')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="admin-form-help location-picker-help">
          {t(
            'admin.location.help',
            '검색 결과를 선택하면 좌표가 저장되고, 공연 페이지에 지도가 표시됩니다.'
          )}
        </p>
      </div>

      {/* 주소는 적혀 있는데 좌표가 없는 상태 — 검색으로 확인되지 않은 주소다.
          저장은 되지만 지도가 뜨지 않으므로, 왜 안 뜨는지 여기서 알려 준다. */}
      {!hasCoords && value.location_address.trim() && (
        <div className="location-picker-unverified">
          <strong>{t('admin.location.unverified', '확인되지 않은 주소')}</strong>
          <span>
            {t(
              'admin.location.unverifiedHelp',
              '적어 주신 주소는 저장되지만 검색으로 확인되지 않아 좌표가 없습니다. 공연 페이지에 지도가 표시되지 않습니다 — 위에서 검색해 결과를 선택하면 지도가 함께 나옵니다.'
            )}
          </span>
        </div>
      )}

      {hasCoords && (
        <div className="location-picker-preview">
          <iframe
            className="location-picker-map"
            src={provider.embedUrl(value.location_lat!, value.location_lng!)}
            title={t('admin.location.mapTitle', '위치 미리보기 지도')}
            loading="lazy"
          />
          <div className="location-picker-preview-meta">
            <span className="location-picker-coords">
              {value.location_address || `${value.location_lat}, ${value.location_lng}`}
            </span>
            <button
              type="button"
              className="admin-btn admin-btn-outline location-picker-clear"
              onClick={clearCoords}
            >
              {t('admin.location.clear', '위치 지우기')}
            </button>
          </div>
        </div>
      )}

      <div className="admin-form-group">
        <label htmlFor="location_url" className="admin-form-label">
          {t('admin.location.url', '지도/길찾기 링크 (선택)')}
        </label>
        <input
          type="url"
          id="location_url"
          value={value.location_url}
          onChange={(e) => onChange({ location_url: e.target.value })}
          placeholder={t(
            'admin.location.urlPlaceholder',
            '비워두면 위 좌표로 길찾기 링크가 자동 생성됩니다'
          )}
          className="admin-form-input"
        />
      </div>
    </div>
  );
}
