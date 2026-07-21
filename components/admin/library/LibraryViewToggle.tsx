'use client';

/**
 * LibraryViewToggle — 공연 둘러보기의 카드/목록 보기 전환
 *
 * 보기 방식은 URL 파라미터(view=card|list)가 결정하고(서버 렌더),
 * 클릭 시 쿠키(library-view)에 저장해 다음 방문의 기본값이 되게 한다
 * (파라미터가 없으면 서버가 쿠키를 읽어 기본 보기를 정한다).
 */

import Link from 'next/link';
import { useT } from '@/lib/i18n/useT';

export type LibraryView = 'card' | 'list';

const CardIcon = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
  </svg>
);

const ListIcon = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h.01M4 12h.01M4 18h.01M8.5 6H20M8.5 12H20M8.5 18H20" />
  </svg>
);

function saveView(view: LibraryView) {
  try {
    document.cookie = `library-view=${view};path=/;max-age=31536000;samesite=lax`;
  } catch {
    /* 쿠키 저장 실패 시에도 파라미터 링크는 동작한다 */
  }
}

export default function LibraryViewToggle({
  view,
  cardHref,
  listHref,
}: {
  view: LibraryView;
  cardHref: string;
  listHref: string;
}) {
  const t = useT();
  const options: Array<{ value: LibraryView; href: string; label: string; icon: React.ReactNode }> = [
    { value: 'card', href: cardHref, label: t('admin.library.viewCard', '카드'), icon: CardIcon },
    { value: 'list', href: listHref, label: t('admin.library.viewList', '목록'), icon: ListIcon },
  ];

  return (
    <div className="library-view-toggle" role="group" aria-label={t('admin.library.view', '보기 방식')}>
      {options.map(({ value, href, label, icon }) => (
        <Link
          key={value}
          href={href}
          className={`library-view-btn ${view === value ? 'active' : ''}`}
          onClick={() => saveView(value)}
          aria-current={view === value ? 'true' : undefined}
        >
          {icon}
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}
