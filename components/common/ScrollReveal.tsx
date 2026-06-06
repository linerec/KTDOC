'use client';

import { useEffect } from 'react';

interface ScrollRevealProps {
  /** 관찰할 셀렉터. 기본값 '.reveal' */
  selector?: string;
  /** 뷰포트 하단에서 얼마나 일찍 트리거할지(px 또는 %) */
  rootMargin?: string;
}

/**
 * 스크롤 진입 시 대상 요소에 `.is-revealed` 를 부여해 은은한 등장 애니메이션을 트리거한다.
 * - SSR에서는 `.reveal` 이 숨겨진 채 렌더되고, 마운트 후 뷰포트 안의 요소부터 순차로 드러난다.
 *   (히어로처럼 처음부터 보이는 영역은 로드 직후 등장 = 홈 heroReveal과 같은 결)
 * - prefers-reduced-motion / IntersectionObserver 미지원 시 즉시 전부 노출(폴백).
 * - 비동기로 DOM 노드를 교체하는 컴포넌트(ImageObject) 자체가 아니라, 그 안정적인
 *   래퍼 요소에 `.reveal` 을 걸 것.
 */
export default function ScrollReveal({
  selector = '.reveal',
  rootMargin = '0px 0px -8% 0px',
}: ScrollRevealProps) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (!els.length) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [selector, rootMargin]);

  return null;
}
