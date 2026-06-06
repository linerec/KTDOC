import { getLatestVideos } from '@/lib/youtube';
import { getSetting, SETTING_HERO_FEATURED_VIDEO } from '@/lib/d1';
import HeroVideos from './HeroVideos';
import { HeroText } from './HeroContent';
import HeroBackground from './HeroBackground';

export default async function Hero() {
  // 후보 영상을 넉넉히 가져와서 대표 영상 선택지로 쓰고, 나머지는 최신순으로 채운다.
  // 설정 테이블이 아직 없거나 조회 실패해도 홈 화면이 깨지지 않도록 null로 폴백.
  const [videos, featuredVideoId] = await Promise.all([
    getLatestVideos(15),
    getSetting(SETTING_HERO_FEATURED_VIDEO).catch(() => null),
  ]);

  return (
    <section id="hero">
      <HeroBackground />
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
