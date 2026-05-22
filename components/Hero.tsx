import { getLatestVideos } from '@/lib/youtube';
import Image from 'next/image';
import VideoCard from './VideoCard';
import { HeroText } from './HeroContent';

const heroBackgroundImages = [
  {
    src: 'https://pub-06654d5ca3e54fa58acbac46039ae9a7.r2.dev/gallery/photos/docs-pictures/1770919299666.jpg',
    position: 'center 56%',
  },
  {
    src: 'https://pub-06654d5ca3e54fa58acbac46039ae9a7.r2.dev/gallery/photos/docs-pictures/1000005223.jpg',
    position: 'center 44%',
  },
  {
    src: 'https://pub-06654d5ca3e54fa58acbac46039ae9a7.r2.dev/gallery/photos/docs-pictures/1728167228227.jpg',
    position: 'center 44%',
  },
];

export default async function Hero() {
  const videos = await getLatestVideos(3);

  return (
    <section id="hero">
      <div className="hero-art-bg" aria-hidden="true">
        <Image
          className="hero-art-preload"
          src={heroBackgroundImages[0].src}
          alt=""
          width={1}
          height={1}
          priority
          unoptimized
        />
        {heroBackgroundImages.map((image) => (
          <div
            className="hero-art-frame"
            key={image.src}
            style={{
              backgroundImage: `url(${image.src})`,
              backgroundPosition: image.position,
            }}
          />
        ))}
      </div>
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
