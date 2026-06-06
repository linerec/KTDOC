'use client';

/**
 * Pagination
 * 재사용 가능한 페이지 번호 네비게이션. 수백~수천 페이지에서도
 * 항상 처음/끝/현재 주변만 노출하고 나머지는 생략(…)한다.
 */

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  /** 현재 페이지 양옆으로 보여줄 페이지 수 (기본 1) */
  siblingCount?: number;
}

type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

function buildPageItems(
  page: number,
  totalPages: number,
  siblingCount: number
): PageItem[] {
  // 페이지가 적으면 전부 노출
  const totalNumbers = siblingCount * 2 + 5; // first, last, current, 2 ellipsis 자리
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, totalPages);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  const items: PageItem[] = [1];

  if (showLeftEllipsis) {
    items.push('ellipsis-left');
  } else {
    for (let i = 2; i < leftSibling; i++) items.push(i);
  }

  for (let i = leftSibling; i <= rightSibling; i++) {
    if (i !== 1 && i !== totalPages) items.push(i);
  }

  if (showRightEllipsis) {
    items.push('ellipsis-right');
  } else {
    for (let i = rightSibling + 1; i < totalPages; i++) items.push(i);
  }

  items.push(totalPages);
  return items;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  siblingCount = 1,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const items = buildPageItems(page, totalPages, siblingCount);
  const go = (next: number) => {
    if (disabled) return;
    const target = Math.min(Math.max(next, 1), totalPages);
    if (target !== page) onPageChange(target);
  };

  return (
    <nav className="pagination" aria-label="페이지 네비게이션">
      <button
        type="button"
        className="pagination-btn pagination-arrow"
        onClick={() => go(page - 1)}
        disabled={disabled || page <= 1}
        aria-label="이전 페이지"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <ul className="pagination-list">
        {items.map((item) => {
          if (item === 'ellipsis-left' || item === 'ellipsis-right') {
            return (
              <li key={item} className="pagination-ellipsis" aria-hidden="true">
                …
              </li>
            );
          }
          const isCurrent = item === page;
          return (
            <li key={item}>
              <button
                type="button"
                className={`pagination-btn pagination-page ${isCurrent ? 'is-current' : ''}`}
                onClick={() => go(item)}
                disabled={disabled}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`${item} 페이지`}
              >
                {item}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="pagination-btn pagination-arrow"
        onClick={() => go(page + 1)}
        disabled={disabled || page >= totalPages}
        aria-label="다음 페이지"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </nav>
  );
}
