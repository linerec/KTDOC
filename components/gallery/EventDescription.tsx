/**
 * 이벤트 설명 본문
 *
 * 작성자가 관리 콘솔에서 넣은 줄바꿈을 공개 페이지에서도 그대로 살린다.
 * - 한 문단짜리 짧은 소개는 기존처럼 가운데 정렬(리드 문장)
 * - 여러 줄로 나뉜 안내문(행사 개요·순서 등)은 왼쪽 정렬(문서형) — 항목이 세로로 정렬돼 읽힌다
 * 줄바꿈 자체는 CSS `white-space: pre-line`이 담당한다.
 */

import type { ReactNode } from 'react';

/** 작성자가 붙여넣기로 가져온 **강조** 표기를 실제 굵은 글씨로 */
const BOLD_PATTERN = /\*\*(.+?)\*\*/g;

function renderInline(text: string): ReactNode {
  if (!text.includes('**')) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(BOLD_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(<strong key={start}>{match[1]}</strong>);
    cursor = start + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return nodes;
}

interface EventDescriptionProps {
  text: string;
  /** 기존 스타일 훅 유지 (gallery-description-ko | gallery-description-en) */
  className: string;
}

export default function EventDescription({ text, className }: EventDescriptionProps) {
  // 윈도우 개행 정규화 + 앞뒤 빈 줄 제거 (빈 줄 하나가 통째로 여백이 되는 걸 방지)
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return null;

  const isDocument = normalized.includes('\n');

  return (
    <div className={isDocument ? `${className} is-document` : className}>
      <p>{renderInline(normalized)}</p>
    </div>
  );
}
