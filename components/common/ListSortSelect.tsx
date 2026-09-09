'use client';

/**
 * ListSortSelect — 공개 목록의 정렬 선택(개최일순 / 등록순)
 *
 * /classes·/performances가 함께 쓴다. 모양은 /gallery 필터(gallery-filter-*)를 그대로
 * 빌려 페이지끼리 같은 얼굴을 갖는다. 선택은 쿼리스트링 `?sort=`로 서버 컴포넌트에
 * 전해지고, 기본값(개최일)일 땐 파라미터를 지워 정규 주소를 유지한다.
 * 해석 규칙은 lib/listSort.ts 한 곳에 있다.
 */

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useT } from '@/lib/i18n/useT';
import { DEFAULT_LIST_SORT, parseListSort, type ListSort } from '@/lib/listSort';

export default function ListSortSelect() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = parseListSort(searchParams.get('sort'));

  const change = (next: ListSort) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_LIST_SORT) params.delete('sort');
    else params.set('sort', next);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  return (
    <div className={`list-sort ${isPending ? 'list-sort-pending' : ''}`}>
      <div className="gallery-filter-group">
        <label htmlFor="list-sort" className="gallery-filter-label">
          {t('common.sort.label', '정렬')}
        </label>
        <select
          id="list-sort"
          className="gallery-filter-select"
          value={current}
          onChange={(e) => change(parseListSort(e.target.value))}
        >
          <option value="date">{t('common.sort.date', '개최일순')}</option>
          <option value="created">{t('common.sort.created', '등록순')}</option>
        </select>
      </div>
    </div>
  );
}
