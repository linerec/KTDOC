'use client';

import { useSession } from 'next-auth/react';
import { useBuilder } from '@/contexts/BuilderContext';
import { isAdmin } from '@/lib/isAdmin';
import ImageObject from '@/components/common/ImageObject';

/**
 * Hero 배경 슬라이드쇼.
 * 3개의 프레임이 CSS 애니메이션으로 크로스페이드되며, 각 프레임의 이미지는
 * 관리자 편집 모드에서 ImageObject를 통해 개별 교체할 수 있다.
 * (편집 전에는 fallbackSrc의 기존 R2 이미지가 그대로 노출됨)
 */
const heroSlides = [
  {
    keycode: 'image.hero.slide1',
    fallbackSrc:
      'https://pub-06654d5ca3e54fa58acbac46039ae9a7.r2.dev/gallery/photos/docs-pictures/1770919299666.jpg',
    position: 'center 56%',
  },
  {
    keycode: 'image.hero.slide2',
    fallbackSrc:
      'https://pub-06654d5ca3e54fa58acbac46039ae9a7.r2.dev/gallery/photos/docs-pictures/1000005223.jpg',
    position: 'center 44%',
  },
  {
    keycode: 'image.hero.slide3',
    fallbackSrc:
      'https://pub-06654d5ca3e54fa58acbac46039ae9a7.r2.dev/gallery/photos/docs-pictures/1728167228227.jpg',
    position: 'center 44%',
  },
];

export default function HeroBackground() {
  const { data: session } = useSession();
  const { isEditMode } = useBuilder();
  // 관리자 편집 모드에서는 슬라이드쇼 애니메이션을 멈추고 3장을 나란히 펼쳐 편집 가능하게 한다.
  const editing = isAdmin(session) && isEditMode;

  return (
    <div
      className={`hero-art-bg${editing ? ' hero-art-bg--editing' : ''}`}
      aria-hidden={editing ? undefined : 'true'}
    >
      {heroSlides.map((slide, index) => (
        <div className="hero-art-frame" key={slide.keycode}>
          <ImageObject
            keycode={slide.keycode}
            fill
            priority={index === 0}
            sizes="100vw"
            quality={80}
            className="hero-art-frame-img"
            containerClassName="hero-art-frame-fill"
            fallbackSrc={slide.fallbackSrc}
            imageStyle={{ objectFit: 'cover', objectPosition: slide.position }}
          />
        </div>
      ))}
    </div>
  );
}
