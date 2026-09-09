'use client';

/**
 * ListSortToggle — 공개 목록의 정렬 선택(개최일순 / 등록순)
 *
 * /classes·/performances가 함께 쓴다. 모양은 /timeline의 정렬·종류 전환
 * (알약형 세그먼트 버튼, 금색 활성)과 같은 CSS(.list-sort-*)를 쓴다 — 공개 사이트에서
 * "고르는 자리"는 한 얼굴이어야 한다. 선택은 쿼리스트링 `?sort=`로 서버 컴포넌트에
 * 전해지고, 기본값(개최일)일 땐 파라미터를 지워 정규 주소를 유지한다.
 * 해석 규칙은 lib/listSort.ts 한 곳에 있다.
 */

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useT } from '@/lib/i18n/useT';
import { DEFAULT_LIST_SORT, LIST_SORTS, parseListSort, type ListSort } from '@/lib/listSort';

export default function ListSortToggle() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = parseListSort(searchParams.get('sort'));

  const change = (next: ListSort) => {
    if (next === current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_LIST_SORT) params.delete('sort');
    else params.set('sort', next);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const labels: Record<ListSort, string> = {
    date: t('common.sort.date', '개최일순'),
    created: t('common.sort.created', '등록순'),
  };

  return (
    <div className={`list-sort-controls${isPending ? ' is-pending' : ''}`}>
      <div className="list-sort" role="group" aria-label={t('common.sort.label', '정렬')}>
        {LIST_SORTS.map((key) => (
          <button
            key={key}
            type="button"
            className={`list-sort-btn${current === key ? ' is-active' : ''}`}
            onClick={() => change(key)}
            aria-pressed={current === key}
          >
            {labels[key]}
          </button>
        ))}
      </div>
    </div>
  );
}
