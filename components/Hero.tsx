import { getLatestVideos } from '@/lib/youtube';
import VideoCard from './VideoCard';
import { HeroText } from './HeroContent';
import HeroBackground from './HeroBackground';

export default async function Hero() {
  const videos = await getLatestVideos(3);

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
            <div className="hero-videos">
              {videos.length > 0 ? (
                <>
                  <VideoCard video={videos[0]} isMain />
                  {videos[1] && <VideoCard video={videos[1]} />}
                  {videos[2] && <VideoCard video={videos[2]} />}
                </>
              ) : (
                <>
                  <div className="video-card video-card-main video-placeholder">
                    <span>영상 준비중</span>
                  </div>
                  <div className="video-card video-placeholder">
                    <span>Coming Soon</span>
                  </div>
                  <div className="video-card video-placeholder">
                    <span>Coming Soon</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
