'use client';

import { useEffect, useRef } from 'react';

/**
 * 헤더 Top Bar의 한국적·단아한 선 인터랙션.
 *
 * 주어진 glowy-waves 히어로의 기법(마우스에 반응하는 캔버스 곡선)을 참조하되,
 * 화려한 글로우 웨이브 대신 "붓이 한 번에 그은 가로 획" 두세 줄로 절제했다.
 * - 색: 금(主)·아이보리(從)·적(印) — globals.css의 ink-ambient 主從印 철학을 잇는다.
 * - 마우스가 헤더 위에 있을 때만 획에 붓압이 실리듯 미세하게 부풀고, 벗어나면 가라앉는다.
 * - prefers-reduced-motion·비가시 탭에서는 흐름을 멈춰 조용하고 가볍게 둔다.
 *
 * pointer-events:none이며 header-inner 뒤(z-index:0)에 깔린다. 크기는 부모(#main-header)를
 * ResizeObserver로 추종하므로 로고 확대/축소(스크롤)에도 자동 대응한다.
 */

interface Stroke {
  baseRatio: number; // 헤더 높이 대비 기준선(0=위, 1=아래)
  amplitude: number; // 기본 진폭(px) — 작을수록 단아
  wavelength: number; // 파장(px)
  speed: number; // 가로 흐름 속도(상대)
  phase: number; // 위상차(主從, 어긋나게)
  width: number; // 선 굵기(px)
  color: string; // "r, g, b"
  alpha: number; // 기본 불투명도
}

const STROKES: Stroke[] = [
  // 主 — 금빛 획. 가장 또렷하지만 여전히 가늘다.
  { baseRatio: 0.6, amplitude: 7, wavelength: 560, speed: 0.55, phase: 0, width: 1.3, color: '212, 160, 23', alpha: 0.34 },
  // 從 — 아이보리. 위상이 어긋나 主를 조용히 뒤따른다.
  { baseRatio: 0.72, amplitude: 5, wavelength: 700, speed: 0.42, phase: Math.PI / 1.6, width: 1.0, color: '246, 239, 226', alpha: 0.2 },
  // 印 — 붉은 기운. 페이지의 인장처럼 가장 옅게.
  { baseRatio: 0.48, amplitude: 9, wavelength: 780, speed: 0.32, phase: Math.PI, width: 0.9, color: '143, 33, 29', alpha: 0.15 },
];

const BUMP_RADIUS = 220; // 마우스 붓압이 미치는 가로 범위(px)
const BUMP_STRENGTH = 12; // 마우스 근처 추가 진폭(px)

export default function HeaderWaves() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 1;
    let height = 1;
    let t = 0;
    // 마우스: x는 헤더 폭 대비 비율(0~1)로 둬서 resize와 무관하게 안정적.
    const cur = { x: 0.5, inside: 0 };
    const target = { x: 0.5, inside: 0 };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const mouseX = cur.x * width;

      for (const s of STROKES) {
        const baseY = height * s.baseRatio;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 2) {
          const flow = Math.sin((x / s.wavelength) * Math.PI * 2 + t * 0.01 * s.speed + s.phase);
          // 마우스 근처에서만 붓압(가우시안). 헤더 밖이면 cur.inside→0으로 사라진다.
          const d = (x - mouseX) / BUMP_RADIUS;
          const bump = Math.exp(-d * d) * BUMP_STRENGTH * cur.inside * Math.sin(t * 0.02 + x * 0.012 + s.phase);
          const y = baseY + flow * s.amplitude + bump;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = s.width;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${s.color}, ${s.alpha})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(${s.color}, ${s.alpha})`;
        ctx.stroke();
      }
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) render(); // 정적 모드: 크기가 바뀔 때만 다시 그린다.
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // 정지(절제) 모드: 흐름·마우스 인터랙션 없이 잔잔한 곡선만 1회 렌더.
    if (reduce) {
      return () => ro.disconnect();
    }

    const onMove = (e: MouseEvent) => {
      const rect = host.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      target.x = (e.clientX - rect.left) / Math.max(1, rect.width);
      target.inside = inside ? 1 : 0;
    };
    const onOut = () => {
      target.inside = 0;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseout', onOut, { passive: true });

    let raf = 0;
    const loop = () => {
      t += 1;
      cur.x += (target.x - cur.x) * 0.08; // 마우스 추종(부드럽게)
      cur.inside += (target.inside - cur.inside) * 0.06; // 진입/이탈 시 서서히 솟고 가라앉음
      render();
      raf = window.requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf) raf = window.requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      stop();
      ro.disconnect();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onOut);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="header-waves" aria-hidden="true" />;
}
