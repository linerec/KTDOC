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

    // <source> 에 주소를 채워 넣는다. 한 번만 하면 된다.
    const arm = () => {
      const pending = video.querySelectorAll<HTMLSourceElement>('source[data-src]');
      if (pending.length === 0) return false;
      pending.forEach((source) => {
        source.src = source.dataset.src as string;
        source.removeAttribute('data-src');
      });
      video.load();
      return true;
    };

    /**
     * 화면에 들어왔을 때 부르는 쪽.
     *
     * 그냥 play() 만 부르면 안 된다. 창을 내렸다 올리거나 한참 화면 밖에 있던 사이
     * 크롬이 이 영상을 **끝 프레임에 세워 둔 채로** 멈춰 놓는 일이 있다. loop 가 켜져
     * 있고 paused 도 false 인데 재생 위치가 길이(7.00초)에 못 박혀 되감기지 않는다.
     * 그 상태로 돌아오면 마지막 프레임이 그대로 떠 있어서 — 얼굴 사진이라 첫 프레임과
     * 거의 같다 — 그냥 사진처럼 보인다. 실제로 그 상태를 이 페이지에서 관측했다.
     *
     * 그래서 끝에 걸려 있으면 되감아 주고 다시 튼다.
     */
    const resume = () => {
      if (arm() === false && video.readyState === 0) video.load();
      if (video.ended || (video.duration && video.currentTime >= video.duration - 0.05)) {
        video.currentTime = 0;
      }
      // 자동재생이 막힌 환경에서는 포스터가 그대로 남는다 — 사진 자리이므로 그래도 맞다
      void video.play().catch(() => {});
    };

    // IntersectionObserver 가 없는 브라우저에서는 그냥 받는다 — 안 보이는 것보다 낫다
    if (typeof IntersectionObserver === 'undefined') {
      resume();
      return;
    }

    let inView = false;

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) resume();
        // 화면 밖에서는 세운다. 크롬은 안 보이는 영상을 알아서 늦추는데, 그 늦춰진
        // 상태에서 끝에 걸리는 것이 위의 그 사고다. 우리가 세워 두면 그 자리가 없다.
        // 디코더도 보이는 것만 돌아간다.
        else if (!video.paused) video.pause();
      },
      // 살짝 앞에서 받아 두되(도착했을 때 이미 움직이고 있도록), 한 화면씩 미리 틀지는
      // 않는다 — 화면 밖에서 재생시키는 것이 애초에 위의 사고를 부른다.
      { rootMargin: '200px 0px', threshold: 0 }
    );
    io.observe(video);

    // 창을 내렸다 올린 경우. 크롬이 감춰진 탭의 미디어를 멈춰 두므로, 돌아왔는데
    // 화면 안에 있으면 위와 같은 방법으로 되살린다.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && inView) resume();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
    };
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
