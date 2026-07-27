'use client';

/**
 * InstagramStripView — 인스타 하이라이트 표시 (클라이언트)
 *
 * 캡션 없이 정사각 사진 3장만 깔고, 아래에 계정 팔로우 링크를 둔다.
 * 이 섹션의 목적은 콘텐츠 소비가 아니라 인스타그램으로의 유도다.
 *
 * 클라이언트인 이유: 등록 0건일 때 편집 모드에서만 섹션을 띄워야 하는데
 * (그러지 않으면 첫 등록 진입점이 없다) isEditMode가 클라이언트 상태다.
 */

import Image from 'next/image';
import { useBuilder } from '@/contexts/BuilderContext';
import { useSiteBusiness } from '@/contexts/SiteBusinessContext';
import IntlObject from '@/components/common/IntlObject';
import ScrollReveal from '@/components/common/ScrollReveal';
import {
  INSTAGRAM_VISIBLE_COUNT,
  highlightAltText,
  type InstagramHighlight,
} from '@/lib/socialHighlights';
import InstagramStripEditor from './InstagramStripEditor';

/** 프로필 URL에서 @핸들을 뽑는다. 실패하면 빈 문자열 */
function handleOf(profileUrl: string): string {
  try {
    const seg = new URL(profileUrl).pathname.split('/').filter(Boolean)[0];
    return seg ? `@${seg}` : '';
  } catch {
    return '';
  }
}

export default function InstagramStripView({ items }: { items: InstagramHighlight[] }) {
  const { isEditMode } = useBuilder();
  const business = useSiteBusiness();
  const profileUrl = business.instagram;

  // 등록이 없으면 섹션을 숨긴다. 단 편집 모드에서는 등록 진입점을 남긴다.
  if (items.length === 0 && !isEditMode) return null;

  const visible = items.slice(0, INSTAGRAM_VISIBLE_COUNT);
  const handle = handleOf(profileUrl);

  return (
    <section id="instagram" className="insta-section" aria-labelledby="insta-title">
      <div className="container">
        <div className="insta-head">
          <IntlObject keycode="home.instagram.eyebrow" className="insta-eyebrow" />
          <h2 id="insta-title" className="insta-title">
            <IntlObject keycode="home.instagram.title" />
          </h2>
        </div>

        {visible.length > 0 ? (
          <div className="insta-grid">
            {visible.map((item, i) => (
              <a
                key={`${item.url}-${i}`}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="insta-card reveal reveal--up"
                style={{ '--reveal-delay': `${i * 70}ms` } as React.CSSProperties}
                aria-label={highlightAltText(item, i)}
              >
                <Image
                  src={item.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 900px) 33vw, 240px"
                  className="insta-card-img"
                />
              </a>
            ))}
          </div>
        ) : (
          <p className="insta-empty">
            등록된 게시물이 없습니다. 아래 설정 버튼으로 추가하세요.
          </p>
        )}

        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="insta-follow"
          >
            {handle || 'Instagram'}
            <span aria-hidden="true"> →</span>
          </a>
        )}
      </div>

      {isEditMode && <InstagramStripEditor initialItems={items} />}
      <ScrollReveal />
    </section>
  );
}
