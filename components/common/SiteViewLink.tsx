'use client';

/**
 * SiteViewLink — 콘솔에서 공개 사이트로 나가는 링크.
 *
 * 브라우저 탭에서는 지금까지처럼 새 창(↗)으로 열어 작업 중이던 콘솔을 남겨 둔다.
 * 홈 화면 앱(standalone)에서는 새 창을 열면 앱 밖 브라우저로 튕겨나가 앱 감각이
 * 끊기므로 같은 창에서 연다. 매니페스트 scope가 '/'라 공개 사이트도 앱 안에 머물고,
 * 공개 헤더의 대시보드 버튼으로 돌아올 수 있다.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useStandalone } from '@/lib/pwa/useStandalone';

interface SiteViewLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  /** 새 창으로 열릴 때 뒤에 ↗를 붙인다(같은 창에서 열리면 붙이지 않는다) */
  arrow?: boolean;
  tabIndex?: number;
}

export default function SiteViewLink({
  href,
  className,
  children,
  arrow = false,
  tabIndex,
}: SiteViewLinkProps) {
  const standalone = useStandalone();
  return (
    <Link
      href={href}
      target={standalone ? undefined : '_blank'}
      rel={standalone ? undefined : 'noopener noreferrer'}
      className={className}
      tabIndex={tabIndex}
    >
      {children}
      {arrow && !standalone ? ' ↗' : ''}
    </Link>
  );
}
