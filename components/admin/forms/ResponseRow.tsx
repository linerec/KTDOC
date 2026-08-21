'use client';

/**
 * ResponseRow — 행 전체가 상세로 가는 링크가 된다
 *
 * 이름 칸에만 링크가 걸려 있어서, 상태 배지나 금액을 눌러 본 사람은 아무 일도
 * 일어나지 않는 경험을 했다. 표에서 한 줄은 한 건이고, 어디를 눌러도 그 건으로
 * 가는 것이 기대에 맞는다.
 *
 * **이름 칸의 진짜 링크는 그대로 둔다.** 여기 걸린 것은 마우스 편의일 뿐이고,
 * 키보드·스크린리더·새 탭 열기는 그 <a> 가 담당한다. tr 을 링크로 흉내 내면
 * (role="link" + tabIndex) 표의 의미가 무너지고 셀 안의 전화·메일 링크와도 겹친다.
 *
 * 셀 안의 링크(전화·메일·이름)를 눌렀을 때는 비켜선다 — 그쪽이 더 구체적인 뜻이다.
 * 글자를 끌어 선택하는 중에도 이동하지 않는다.
 */

import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

interface ResponseRowProps {
  href: string;
  children: ReactNode;
}

export default function ResponseRow({ href, children }: ResponseRowProps) {
  const router = useRouter();

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    // 새 탭·새 창으로 여는 조작은 브라우저에 맡긴다.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('a, button, input, label')) return;
    if (window.getSelection()?.toString()) return;
    router.push(href);
  }

  return (
    <tr className="admin-row-link" onClick={onClick}>
      {children}
    </tr>
  );
}
