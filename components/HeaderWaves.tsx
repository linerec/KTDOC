'use client';

import { useEffect, useRef } from 'react';

/**
 * 헤더 Top Bar의 한국적·단아한 선 인터랙션.
 *
 * 주어진 glowy-waves 히어로의 기법(마우스에 반응하는 캔버스 곡선)을 참조하되,
 * 화려한 글로우 웨이브 대신 "붓이 한 번에 그은 가로 획" 세 줄로 절제했다.
 * - 색: KTDOC 로고 상단 스우시의 세 붓질 — 적(224,47,50)·황(240,148,26)·청(27,110,182).
 *   애니메이션과 로고가 같은 팔레트로 테마를 공유한다.
 * - 곡선뿐 아니라 굵기도 붓획처럼 부드럽게 변조된다(가변 두께 리본). 저주파 사인 합으로
 *   불규칙하되 매끄럽게 부풀고 잦아든다.
 * - 마우스가 헤더 위에 있을 때만 그 근처 획에 붓압이 실리듯 진폭·굵기가 함께 부풀고,
 *   벗어나면 가라앉는다.
 * - prefers-reduced-motion·비가시 탭에서는 흐름을 멈춰 조용하고 가볍게 둔다.
 *
 * pointer-events:none이며 header-inner 뒤(z-index:0)에 깔린다. 크기는 부모(#main-header)를
 * ResizeObserver로 추종하므로 로고 확대/축소(스크롤)에도 자동 대응한다.
 *
 * 부모 크기를 따라가는 범용 캔버스라 다른 호스트에서도 재사용할 수 있다 —
 * className으로 배치 스타일만 바꾼다(예: 관리 콘솔 사이드바 브랜드 .admin-brand-waves).
 */

interface Stroke {
  baseRatio: number; // 헤더 높이 대비 기준선(0=위, 1=아래)
  amplitude: number; // 기본 진폭(px) — 작을수록 단아
  wavelength: number; // 파장(px)
  speed: number; // 가로 흐름 속도(상대)
  phase: number; // 위상차(어긋나게)
  width: number; // 평균 획 굵기(px) — 실제 굵기는 이 값을 중심으로 변조된다
  widthVar: number; // 굵기 변조 폭(0~1) — 클수록 붓압 강약이 뚜렷
  color: string; // "r, g, b"
  alpha: number; // 기본 불투명도
}

// 로고 스우시 순서(위→아래)를 따라 적·황·청을 배치한다.
const STROKES: Stroke[] = [
  // 赤 — 로고 맨 위 붉은 붓질. 가장 또렷하다.
  { baseRatio: 0.46, amplitude: 7, wavelength: 560, speed: 0.55, phase: 0, width: 2.6, widthVar: 0.92, color: '224, 47, 50', alpha: 0.3 },
  // 黃 — 가운데 금빛 붓질. 위상이 어긋나 赤을 뒤따른다.
  { baseRatio: 0.58, amplitude: 6, wavelength: 700, speed: 0.42, phase: Math.PI / 1.6, width: 2.4, widthVar: 0.88, color: '240, 148, 26', alpha: 0.26 },
  // 靑 — 맨 아래 푸른 붓질. 가장 길고 느긋하게 흐른다.
  { baseRatio: 0.7, amplitude: 8, wavelength: 780, speed: 0.32, phase: Math.PI, width: 2.2, widthVar: 0.85, color: '27, 110, 182', alpha: 0.24 },
];

const BUMP_RADIUS = 220; // 마우스 붓압이 미치는 가로 범위(px)
const BUMP_STRENGTH = 12; // 마우스 근처 추가 진폭(px)

export default function HeaderWaves({ className = 'header-waves' }: { className?: string }) {
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
        // 굵기 변조의 파장 — 곡선 파장에 묶어 스케일을 일치시킨다(저주파 2겹).
        const w1 = s.wavelength * 0.28;
        const w2 = s.wavelength * 0.13;

        // 중심선(x, y)과 반폭(half)을 함께 샘플링한다.
        const pts: Array<[number, number, number]> = [];
        for (let x = 0; x <= width; x += 2) {
          const flow = Math.sin((x / s.wavelength) * Math.PI * 2 + t * 0.01 * s.speed + s.phase);
          // 마우스 근접도(가우시안). 헤더 밖이면 cur.inside→0으로 사라진다.
          const d = (x - mouseX) / BUMP_RADIUS;
          const g = Math.exp(-d * d) * cur.inside;
          const bump = g * BUMP_STRENGTH * Math.sin(t * 0.02 + x * 0.012 + s.phase);
          const y = baseY + flow * s.amplitude + bump;
          // 붓획 두께: 저주파 사인 합으로 부드럽게 강약을 준 뒤, 마우스 근처는 붓압으로 부풀린다.
          const nz =
            Math.sin(x / w1 + t * 0.006 * s.speed + s.phase) +
            0.6 * Math.sin(x / w2 - t * 0.004 * s.speed + s.phase * 1.7);
          const profile = 1 + s.widthVar * (nz / 1.6); // ≈ [1-var, 1+var]
          const half = Math.max(0.35, s.width * 0.5 * profile * (1 + g * 0.9));
          pts.push([x, y, half]);
        }

        // 가변 두께 리본: 위 모서리를 →로, 아래 모서리를 ←로 이어 닫고 채운다.
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const [x, y, half] = pts[i];
          if (i === 0) ctx.moveTo(x, y - half);
          else ctx.lineTo(x, y - half);
        }
        for (let i = pts.length - 1; i >= 0; i--) {
          const [x, y, half] = pts[i];
          ctx.lineTo(x, y + half);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(${s.color}, ${s.alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${s.color}, ${Math.min(1, s.alpha * 1.6)})`;
        ctx.fill();
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

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
