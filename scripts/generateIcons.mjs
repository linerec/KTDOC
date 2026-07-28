/**
 * 아이콘 생성기 — KTDOC 로고 상단 스우시(赤·黃·靑 세 붓질)를 정사각 아이콘 계열로 뽑는다.
 *
 * 원본 로고(public/assets/logo/logo_default.png)의 스우시를 정사각형에 맞게 벡터로
 * 다시 그린다. 왼쪽 아래에서 프레임 밖으로 흘려 잘리고 오른쪽 끝만 뾰족하게 사라지는
 * 붓획 성질을 유지한다. 색은 components/HeaderWaves.tsx에 정의된 값과 같다 —
 * 로고·헤더 붓질 애니메이션·아이콘이 한 팔레트를 공유한다.
 *
 * 산출물(모두 저장소에 커밋한다):
 *   app/icon.svg                    모던 브라우저 탭
 *   app/favicon.ico                 레거시 탭·구글 검색결과 (16/32/48)
 *   app/apple-icon.png              iOS 홈 화면 (180px, 각진 사각 — iOS가 직접 마스킹)
 *   public/icon-192.png             매니페스트 purpose:any
 *   public/icon-512.png             매니페스트 purpose:any
 *   public/icon-maskable-512.png    매니페스트 purpose:maskable (안전영역 안에 축소 배치)
 *
 * 실행: npm run icons
 * 곡선·굵기·간격을 바꾸고 싶으면 아래 STROKES를 고치고 다시 돌린다.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = 512; // 마스터 좌표계
const RADIUS = 104; // 라운드 사각 모서리(iOS 스퀘어클 비율에 가깝게)
const BG = '#0a0a0a'; // 먹빛 바탕

// HeaderWaves.tsx의 赤·黃·靑 — 값을 바꿀 땐 그쪽도 함께
const COLORS = ['#e02f32', '#f0941a', '#1b6eb6'];

// 획마다 제 곡선을 둔다. 원본의 겹쌓임을 따라 뒤 획일수록 오른쪽에서 시작해 먼저 끝난다.
// c: 큐빅 베지어 제어점(정규 좌표 0~1, 1을 넘으면 프레임 밖 = 잘려 흐른다)
// w: 최대 반폭(정규 좌표)
const STROKES = [
  { c: [[-0.18, 1.14], [0.20, 0.92], [0.30, 0.12], [1.06, 0.06]], w: 0.064 }, // 赤
  { c: [[0.09, 1.14], [0.42, 0.96], [0.50, 0.30], [1.01, 0.25]], w: 0.058 }, // 黃
  { c: [[0.35, 1.14], [0.63, 1.00], [0.69, 0.48], [0.96, 0.44]], w: 0.052 }, // 靑
];

const SAMPLES = 96; // 외곽선 샘플 수 — 512px에서 계단이 보이지 않는 최소치

function bezier(p, t) {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}

/** 중심선을 샘플링하고 법선 방향으로 가변 반폭을 주어 붓획 리본의 외곽선을 만든다. */
function ribbonPath({ c, w }) {
  const pts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    pts.push([...bezier(c, u), u]);
  }

  // 진입부는 짧게 부풀어 이미 두껍고(프레임에서 잘린다), 오른쪽 끝은 길게 뾰족해진다
  const halfWidth = (u) =>
    w * Math.pow(Math.min(1, u / 0.1), 0.5) * Math.pow(1 - u, 0.68) * 1.6;

  const top = [];
  const bottom = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y, u] = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(SAMPLES, i + 1)];
    let nx = -(next[1] - prev[1]);
    let ny = next[0] - prev[0];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const h = halfWidth(u);
    top.push([x + nx * h, y + ny * h]);
    bottom.push([x - nx * h, y - ny * h]);
  }

  const fmt = (p) => `${(p[0] * S).toFixed(1)},${(p[1] * S).toFixed(1)}`;
  return (
    `M${fmt(top[0])}` +
    top.slice(1).map((p) => `L${fmt(p)}`).join('') +
    bottom.reverse().map((p) => `L${fmt(p)}`).join('') +
    'Z'
  );
}

/**
 * 마스커블용 변형 — 마크 전체를 가운데로 축소해 안전영역(가운데 80% 원) 안에 들이되,
 * 꼬리는 제어점을 바깥으로 더 밀어 프레임 밖으로 계속 흘려 보낸다(잘려야 자연스럽다).
 * @param {number} scale 가운데 기준 축소 비율
 * @param {number} tailBleed 꼬리 제어점을 P1에서 얼마나 더 밀어낼지(1 = 그대로)
 */
function transformStroke({ c, w }, scale, tailBleed) {
  const toCenter = ([x, y]) => [0.5 + (x - 0.5) * scale, 0.5 + (y - 0.5) * scale];
  const s = c.map(toCenter);
  s[0] = [s[1][0] + (s[0][0] - s[1][0]) * tailBleed, s[1][1] + (s[0][1] - s[1][1]) * tailBleed];
  return { c: s, w: w * scale };
}

/**
 * @param {object} opts
 * @param {boolean} opts.rounded 모서리를 둥글릴지(iOS·안드로이드 마스커블은 각진 사각)
 * @param {number} [opts.scale] 마크 축소 비율(마스커블 안전영역용)
 * @param {number} [opts.tailBleed] 꼬리를 프레임 밖으로 더 밀어내는 배수
 */
function buildSvg({ rounded, scale = 1, tailBleed = 1 }) {
  const strokes =
    scale === 1 && tailBleed === 1
      ? STROKES
      : STROKES.map((s) => transformStroke(s, scale, tailBleed));
  const marks = strokes
    .map((s, i) => `<path d="${ribbonPath(s)}" fill="${COLORS[i]}"/>`)
    .join('\n    ');
  const clip = rounded
    ? `<defs><clipPath id="c"><rect width="${S}" height="${S}" rx="${RADIUS}"/></clipPath></defs>\n  `
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  ${clip}<g${rounded ? ' clip-path="url(#c)"' : ''}>
    <rect width="${S}" height="${S}" fill="${BG}"/>
    ${marks}
  </g>
</svg>
`;
}

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/**
 * PNG 엔트리를 담는 ICO 컨테이너를 직접 조립한다(sharp는 .ico를 쓰지 못한다).
 * 구조: ICONDIR 6바이트 + ICONDIRENTRY 16바이트 × N + PNG 페이로드.
 * PNG를 품은 ICO는 Windows Vista 이상과 모든 최신 브라우저가 읽는다.
 */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const dir = [];
  for (const { size, data } of entries) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // 팔레트 색 수(트루컬러 = 0)
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    dir.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.data)]);
}

async function main() {
  const roundedSvg = buildSvg({ rounded: true });
  const squareSvg = buildSvg({ rounded: false });
  // 마스커블: 마크가 안전영역(가운데 80% 원) 밖으로 나가면 런처가 잘라먹는다.
  // 대각선을 가로지르는 구도라 축소 폭이 큰 대신, 마스크가 잘라내는 만큼 되살아난다.
  const maskableSvg = buildSvg({ rounded: false, scale: 0.62, tailBleed: 3.2 });

  const out = [];

  // 모던 브라우저 탭 — 벡터 그대로
  out.push([path.join(ROOT, 'app/icon.svg'), Buffer.from(roundedSvg)]);

  // 레거시 탭·구글 검색결과
  const icoSizes = [16, 32, 48];
  const icoEntries = await Promise.all(
    icoSizes.map(async (size) => ({ size, data: await png(roundedSvg, size) }))
  );
  out.push([path.join(ROOT, 'app/favicon.ico'), buildIco(icoEntries)]);

  // iOS 홈 화면 — 각진 사각(iOS가 직접 둥글린다). 알파는 무시되므로 불투명 그대로.
  out.push([path.join(ROOT, 'app/apple-icon.png'), await png(squareSvg, 180)]);

  // 안드로이드 설치
  out.push([path.join(ROOT, 'public/icon-192.png'), await png(roundedSvg, 192)]);
  out.push([path.join(ROOT, 'public/icon-512.png'), await png(roundedSvg, 512)]);
  out.push([path.join(ROOT, 'public/icon-maskable-512.png'), await png(maskableSvg, 512)]);

  for (const [file, data] of out) {
    await writeFile(file, data);
    console.log(`✓ ${path.relative(ROOT, file)}  ${(data.length / 1024).toFixed(1)}KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
