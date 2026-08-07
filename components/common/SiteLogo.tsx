'use client';

/**
 * SiteLogo — 테마에 맞는 로고 변형을 고르는 워드마크.
 *
 * logo_white.png는 흰 글자라 한지 지면에서 사라진다. 같은 로고의 검은 워드마크
 * (logo_default.png)가 이미 있으므로 테마에서 변형을 파생시킨다.
 *
 * 단 **사진 위에 놓이는 로고는 항상 흰색**이 정답이다(about 히어로 등) —
 * 그런 자리에서는 이 컴포넌트를 쓰지 말고 흰 로고를 직접 지정할 것.
 */

import Image from 'next/image';
import { useSiteTheme } from '@/contexts/SiteThemeContext';
import { headerLogoAsset } from '@/lib/headerBackground';

interface SiteLogoProps {
  /** 렌더 높이(px). 폭은 원본 비율로 자동 계산된다. */
  height?: number;
  className?: string;
  priority?: boolean;
}

export default function SiteLogo({ height = 50, className, priority }: SiteLogoProps) {
  const { theme } = useSiteTheme();
  const asset = headerLogoAsset(theme === 'light' ? 'default' : 'white');
  return (
    <Image
      src={asset.src}
      alt="KTDOC Logo"
      width={asset.width}
      height={asset.height}
      className={className}
      style={{ height: `${height}px`, width: 'auto' }}
      priority={priority}
    />
  );
}
