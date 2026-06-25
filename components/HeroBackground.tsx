'use client';

import { useSession } from 'next-auth/react';
import { useBuilder } from '@/contexts/BuilderContext';
import { isAdmin } from '@/lib/isAdmin';
import ImageObject from '@/components/common/ImageObject';
import HeroBackgroundManager, { type HeroSlide } from '@/components/HeroBackgroundManager';

/**
 * Hero 배경 슬라이드쇼.
 * 3개의 프레임이 CSS 애니메이션으로 크로스페이드되며, 각 프레임의 이미지는
 * 관리자 편집 모드에서 별도의 "배경 이미지 관리" 모달(HeroBackgroundManager)을 통해
 * 교체·관리한다. 배경 슬라이드 자체에는 편집 UI를 노출하지 않아 상단 툴바와 겹치지 않는다.
 */
export const heroSlides: HeroSlide[] = [
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
  // 관리자 편집 모드에서만 배경 관리 진입점을 노출한다.
  const canManage = isAdmin(session) && isEditMode;

  return (
    <>
      <div className="hero-art-bg" aria-hidden="true">
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
              disableInlineEdit
            />
          </div>
        ))}
      </div>

      {canManage && <HeroBackgroundManager slides={heroSlides} />}
    </>
  );
}
