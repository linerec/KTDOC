import { getLatestVideos } from '@/lib/youtube';
import { getSetting, SETTING_HERO_FEATURED_VIDEO, SETTING_HERO_OVERLAY } from '@/lib/d1';
import { parseHeroOverlay, toHeroCssVars } from '@/lib/heroBackground';
import HeroVideos from './HeroVideos';
import { HeroText } from './HeroContent';
import HeroBackground from './HeroBackground';

export default async function Hero() {
  // 후보 영상을 넉넉히 가져와서 대표 영상 선택지로 쓰고, 나머지는 최신순으로 채운다.
  // 설정 테이블이 아직 없거나 조회 실패해도 홈 화면이 깨지지 않도록 null로 폴백.
  const [videos, featuredVideoId, overlayRaw] = await Promise.all([
    getLatestVideos(15),
    getSetting(SETTING_HERO_FEATURED_VIDEO).catch(() => null),
    getSetting(SETTING_HERO_OVERLAY).catch(() => null),
  ]);

  // 배경 톤·필터 설정 — null이면 globals.css의 var() 기본값이 그대로 적용된다.
  const overlay = parseHeroOverlay(overlayRaw);

  return (
    <section id="hero" style={toHeroCssVars(overlay) as React.CSSProperties}>
      <HeroBackground overlay={overlay} />
      {/* 한지에 스며드는 먹: 앰비언트 잉크 워시. 슬라이드쇼 위·비네트 아래에 깔려
          텍스트 대비를 해치지 않고 호흡하듯 은은하게 번진다. (POC) */}
      <div className="hero-ink-wash" aria-hidden="true">
        <span className="ink-blob ink-blob--gold" />
        <span className="ink-blob ink-blob--ivory" />
      </div>
      <div className="hero-container">
        {/* Bottom - Content Grid */}
        <div className="hero-content-grid">
          {/* Left Side - Text and Button (Client Component for editing) */}
          <HeroText />

          {/* Right Side - Video Gallery (2/3) */}
          <div className="hero-right">
            <HeroVideos videos={videos} featuredVideoId={featuredVideoId} />
          </div>
        </div>
      </div>
    </section>
  );
}
