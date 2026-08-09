'use client';

/**
 * 페이지 상단 탭 — 링크다(버튼이 아니라)
 *
 * 탭 상태를 주소에 두면 링크로 건네줄 수 있고 뒤로 가기가 동작하며,
 * 서버가 보이는 탭에 필요한 질의만 돌릴 수 있다.
 *
 * 클라이언트 컴포넌트인 이유는 라벨과 aria-label을 useT로 번역하기 때문이다.
 */

import Link from 'next/link';
import { useT } from '@/lib/i18n/useT';

export interface AdminPageTab {
  /** 이 탭을 가리키는 값 — current와 비교해 활성 여부를 정한다 */
  value: string;
  href: string;
  /** 라벨 키코드 + 한국어 폴백 */
  labelKey: string;
  labelKo: string;
  count?: number;
}

interface AdminPageTabsProps {
  tabs: AdminPageTab[];
  current: string;
  /** 이 탭 묶음이 무엇을 고르는지 — 스크린리더용 */
  ariaLabelKey: string;
  ariaLabelKo: string;
}

export default function AdminPageTabs({
  tabs,
  current,
  ariaLabelKey,
  ariaLabelKo,
}: AdminPageTabsProps) {
  const t = useT();

  return (
    <nav className="admin-page-tabs" aria-label={t(ariaLabelKey, ariaLabelKo)}>
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          className={`admin-page-tab${current === tab.value ? ' is-active' : ''}`}
          aria-current={current === tab.value ? 'page' : undefined}
        >
          {t(tab.labelKey, tab.labelKo)}
          {tab.count !== undefined && <span className="admin-page-tab-count">{tab.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
