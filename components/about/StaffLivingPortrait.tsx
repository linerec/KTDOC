'use client';

/**
 * 선생님 리빙 포트레이트 — 프로필 사진 자리에서 잔잔한 무음 루프가 돈다.
 *
 * 단장(`DirectorLivingPortrait`)과 달리 이스터에그(웃는 얼굴)는 없다. 페이지에서
 * 단장 자리가 가장 크고 유일하게 반응하는 곳이라는 위계를 그대로 둔다.
 *
 * 이 자리는 화면 한참 아래라, 안 보이는 동안에는 파일을 받지 않는다. `<source>` 를
 * 빈 채로 그려 두고 뷰포트에 가까워졌을 때 주소를 채운다 — 그냥 켜 두면 about 페이지가
 * 처음부터 받는 영상이 넷이 된다. 상태 대신 DOM 을 직접 만지는 이유는, 이 일이
 * 화면에 그릴 것을 정하는 게 아니라 브라우저에게 받아 오라고 시키는 일이기 때문이다.
 *
 * 동작 최소화를 켠 사람에게는 영상을 감추고 정지 이미지만 남긴다(CSS).
 */

import { useEffect, useRef } from 'react';

export default function StaffLivingPortrait({
  name,
  alt,
}: {
  /** 파일 이름의 가운데 토막 — /assets/video/staff-<name>-portrait.{webm,mp4,jpg} */
  name: string;
  alt: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const poster = `/assets/video/staff-${name}-portrait.jpg`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const start = () => {
      let armed = false;
      video.querySelectorAll<HTMLSourceElement>('source[data-src]').forEach((source) => {
        source.src = source.dataset.src as string;
        armed = true;
      });
      if (!armed) return;
      video.load();
      // 자동재생이 막힌 환경에서는 포스터가 그대로 남는다 — 사진 자리이므로 그래도 맞다
      void video.play().catch(() => {});
    };

    // IntersectionObserver 가 없는 브라우저에서는 그냥 받는다 — 안 보이는 것보다 낫다
    if (typeof IntersectionObserver === 'undefined') {
      start();
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        start();
      },
      // 화면에 들어오기 한 화면 전에 미리 받아 둔다 — 도착했을 때 정지 이미지가 아니라
      // 이미 움직이고 있어야 이 장치가 보인다
      { rootMargin: '100% 0px' }
    );

    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <div className="staff-portrait-stack">
      <video
        ref={videoRef}
        className="staff-portrait-video"
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload="none"
        aria-label={alt}
      >
        {/* webm 이 mp4 보다 작아 먼저 둔다 — 브라우저는 재생 가능한 첫 소스를 고른다 */}
        <source data-src={`/assets/video/staff-${name}-portrait.webm`} type="video/webm" />
        <source data-src={`/assets/video/staff-${name}-portrait.mp4`} type="video/mp4" />
      </video>

      {/* 동작 최소화에서만 보이는 정지 이미지 — 평소에는 CSS 가 감춘다 */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 영상과 같은 상자에 겹쳐 두는 대체 이미지라 최적화 파이프라인을 태우지 않는다 */}
      <img className="staff-portrait-still" src={poster} alt={alt} loading="lazy" />
    </div>
  );
}
