'use client';

/**
 * VideoBadge — "이 공연에는 영상이 있습니다"
 *
 * 목록에서 카드를 훑을 때, 눌러 보기 전에 영상이 있는지 알 수 있어야 한다.
 * 들어가서야 아는 것과 들어가기 전에 아는 것의 차이는 크다 — 영상을 보려고 들른
 * 사람이 카드를 하나씩 열어 볼 이유가 없어진다.
 *
 * 사진 위에 얹히므로 색은 테마를 따르지 않는다(공개 테마 규칙 2: 사진·영상 위
 * 전경은 var(--on-media)). 글자 없이 삼각형만 두면 '재생 버튼'으로 오해해
 * 누르는 사람이 생긴다 — 카드는 상세로 가는 링크이지 재생기가 아니다. 그래서
 * 작은 글자를 함께 둔다.
 *
 * 개수가 여럿이면 숫자를 붙인다("영상 3"). 하나면 숫자는 군더더기다.
 */

import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  count?: number;
  /** 카드가 작아 글자가 버거운 자리(타임라인 등)는 아이콘만 */
  compact?: boolean;
}

export default function VideoBadge({ count = 0, compact = false }: Props) {
  const { locale } = useLanguage();
  if (count < 1) return null;

  const label = locale === 'ko' ? '영상' : 'Video';
  const text = count > 1 ? `${label} ${count}` : label;

  return (
    <span
      className={`video-badge${compact ? ' is-compact' : ''}`}
      role="img"
      aria-label={text}
      title={text}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M9 7.5v9l7.5-4.5z" fill="currentColor" />
        <rect
          x="2.2"
          y="4.2"
          width="19.6"
          height="15.6"
          rx="3.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
      {!compact && <span className="video-badge-text">{text}</span>}
    </span>
  );
}
