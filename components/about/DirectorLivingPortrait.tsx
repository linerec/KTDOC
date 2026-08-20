'use client';

/**
 * 원장 리빙 포트레이트 — 평소에는 잔잔한 루프가 돌고, 마우스를 올리거나 손으로 짚으면
 * 잠깐 웃으신다. 정보가 아니라 인사에 가까운 장치라 실패해도 화면은 그대로다.
 *
 * 두 영상을 겹쳐 두고 투명도만 바꾼다. 교체(src 갈아끼우기)로 만들면 새 파일을
 * 받아 첫 프레임을 그릴 때까지 한 박자 비는데, 웃는 순간이 늦으면 장치가 죽는다.
 *
 * 동작 최소화를 켠 사람에게는 두 영상 다 감추고 정지 이미지만 남는다(CSS). 갑자기
 * 움직이는 얼굴은 그 설정을 켠 이유 그 자체다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const IDLE_POSTER = '/assets/video/director-portrait.jpg';

/** 웃는 영상 길이(5.17초)만큼만 보여 주고 돌아온다 — 손가락에는 '떼는' 동작이 없다 */
const SMILE_MS = 5200;

export default function DirectorLivingPortrait({ alt }: { alt: string }) {
  const [smiling, setSmiling] = useState(false);
  const smileRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 처음부터 다시 튼다. 이어보기로 두면 이미 웃고 있는 중간부터 나와 장치가 안 보인다.
  const startSmile = useCallback(() => {
    const video = smileRef.current;
    if (video) {
      video.currentTime = 0;
      // 자동재생이 막힌 환경에서도 화면은 그냥 잔잔한 쪽이 계속 보인다
      void video.play().catch(() => {});
    }
    setSmiling(true);
  }, []);

  const stopSmile = useCallback(() => {
    clearTimer();
    setSmiling(false);
  }, [clearTimer]);

  const handlePointerEnter = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse') return; // 터치는 아래 onTouchStart 가 맡는다
      clearTimer();
      startSmile();
    },
    [clearTimer, startSmile]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      stopSmile();
    },
    [stopSmile]
  );

  const handleTouchStart = useCallback(() => {
    clearTimer();
    startSmile();
    timerRef.current = setTimeout(() => setSmiling(false), SMILE_MS);
  }, [clearTimer, startSmile]);

  // 페이드가 끝나 완전히 가려지면 멈춘다. 바로 멈추면 사라지는 동안 얼굴이 굳고,
  // 안 멈추면 한 번 스친 뒤로 계속 돌아간다.
  const handleTransitionEnd = useCallback(() => {
    if (!smiling) smileRef.current?.pause();
  }, [smiling]);

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <div
      className="director-portrait-stack"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onTouchStart={handleTouchStart}
    >
      {/* webm 이 mp4 보다 작아 먼저 둔다 — 브라우저는 재생 가능한 첫 소스를 고른다 */}
      <video
        className="director-portrait-video"
        poster={IDLE_POSTER}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-label={alt}
      >
        <source src="/assets/video/director-portrait.webm" type="video/webm" />
        <source src="/assets/video/director-portrait.mp4" type="video/mp4" />
      </video>

      <video
        ref={smileRef}
        className="director-portrait-video director-portrait-video--smile"
        data-active={smiling}
        onTransitionEnd={handleTransitionEnd}
        loop
        muted
        playsInline
        preload="none"
        aria-hidden="true"
      >
        <source src="/assets/video/director-portrait-smile.webm" type="video/webm" />
        <source src="/assets/video/director-portrait-smile.mp4" type="video/mp4" />
      </video>

      {/* 동작 최소화에서만 보이는 정지 이미지 — 평소에는 CSS 가 감춘다 */}
      <img className="about-director-portrait-still" src={IDLE_POSTER} alt={alt} />
    </div>
  );
}
