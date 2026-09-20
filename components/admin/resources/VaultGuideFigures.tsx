/**
 * 공연 자료함 안내 — 개념 그림 (인라인 SVG)
 *
 * 안내 페이지의 나머지는 **진짜 화면 캡처**다. 우리 화면이라 남의 상표가 찍힐 일도,
 * 우리 모르게 바뀔 일도 없어서 캡처가 정직하다. 그림이 맡는 자리는 따로 있다 —
 * **캡처로는 찍을 수 없는 것**, 곧 "무엇이 무엇을 대신하는가"와 "번호와 비밀번호는
 * 서로 다른 물건이다"라는 머릿속 그림이다. 이 둘은 어느 한 화면에도 들어 있지 않다.
 *
 * 그림 규칙은 YouTubeLinkGuide와 같다: 눈이 가야 할 한 곳만 금색, 나머지는 흐리게.
 * 인라인 SVG라 요청이 0건이고 두 테마를 자동으로 따라간다.
 */

/** 순서를 말하는 금색 번호 */
function Badge({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g className="rvg-badge">
      <circle cx={x} cy={y} r="11" />
      <text x={x} y={y + 4.5} textAnchor="middle">
        {n}
      </text>
    </g>
  );
}

/** 세 그림이 같은 상자를 쓴다 — 한 줄로 늘어놓았을 때 눈이 편하다 */
function Fig({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 140 132" className="rvg-fig" role="img" aria-hidden="true">
      {children}
    </svg>
  );
}

/** QR을 흉내 낸 작은 격자 — 실제 QR이 아니라 "QR이라는 물건"의 그림이다 */
function QrGlyph({ x, y, s }: { x: number; y: number; s: number }) {
  const cell = s / 7;
  const on = [
    [0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2],
    [4, 0], [6, 0], [5, 1], [4, 2], [6, 2],
    [0, 4], [1, 4], [2, 4], [0, 5], [2, 5], [0, 6], [1, 6], [2, 6],
    [4, 4], [5, 5], [6, 4], [4, 6], [6, 6], [5, 3], [3, 5],
  ];
  return (
    <g className="rvg-qr">
      <rect x={x} y={y} width={s} height={s} rx="2" className="rvg-qr-bg" />
      {on.map(([cx, cy]) => (
        <rect
          key={`${cx}-${cy}`}
          x={x + cx * cell + cell * 0.1}
          y={y + cy * cell + cell * 0.1}
          width={cell * 0.8}
          height={cell * 0.8}
        />
      ))}
    </g>
  );
}

/* ── 흐름 세 컷 ───────────────────────────────────────────────── */

/** ① 미리 올려 둔다 — 관리 콘솔의 자료함 */
export function FigUpload() {
  return (
    <Fig>
      <rect className="rvg-frame" x="10" y="14" width="120" height="96" rx="7" />
      <path className="rvg-bar" d="M10 21 a7 7 0 0 1 7-7 h106 a7 7 0 0 1 7 7 v5 H10 z" />
      <g className="rvg-dot">
        <circle cx="19" cy="20" r="2" />
        <circle cx="27" cy="20" r="2" />
        <circle cx="35" cy="20" r="2" />
      </g>
      <g className="rvg-dim">
        <rect className="rvg-row" x="19" y="36" width="102" height="14" rx="3" />
        <rect className="rvg-row" x="19" y="54" width="102" height="14" rx="3" />
        <rect className="rvg-row" x="19" y="72" width="102" height="14" rx="3" />
      </g>
      <g className="rvg-note">
        <path d="M30 46 v-9 l6 -1.6 v9" fill="none" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="28.4" cy="46.4" r="1.9" />
        <circle cx="34.4" cy="44.8" r="1.9" />
      </g>
      <g className="rvg-note rvg-dim">
        <path d="M30 64 v-9 l6 -1.6 v9" fill="none" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="28.4" cy="64.4" r="1.9" />
        <circle cx="34.4" cy="62.8" r="1.9" />
        <path d="M30 82 v-9 l6 -1.6 v9" fill="none" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="28.4" cy="82.4" r="1.9" />
        <circle cx="34.4" cy="80.8" r="1.9" />
      </g>
      <g className="rvg-hit">
        <rect x="50" y="90" width="40" height="15" rx="7.5" />
      </g>
      <g className="rvg-hit-glyph">
        <path d="M70 94.5 v6 M67 97.5 h6" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      {/* 번호는 누를 곳을 가리키되 덮지 않는다 — 알약 왼쪽 끝에 걸쳐 둔다 */}
      <Badge x={52} y={97} n={1} />
    </Fig>
  );
}

/** ② 번호와 비밀번호를 건넨다 — 쪽지 한 장 또는 QR */
export function FigHandOff() {
  return (
    <Fig>
      <rect className="rvg-card" x="14" y="24" width="112" height="76" rx="8" />
      <text className="rvg-bignum" x="47" y="56" textAnchor="middle">
        473128
      </text>
      <g className="rvg-pass">
        <circle cx="33" cy="72" r="3" />
        <circle cx="41" cy="72" r="3" />
        <circle cx="49" cy="72" r="3" />
        <circle cx="57" cy="72" r="3" />
      </g>
      <line className="rvg-split" x1="84" y1="34" x2="84" y2="90" />
      <QrGlyph x={94} y={44} s={24} />
      <Badge x={126} y={28} n={2} />
    </Fig>
  );
}

/** ③ 공연장에서 번호로 연다 — 무대 뒤 태블릿 */
export function FigOpen() {
  return (
    <Fig>
      <rect className="rvg-frame" x="34" y="8" width="72" height="116" rx="9" />
      <rect className="rvg-screen" x="40" y="18" width="60" height="96" rx="4" />
      <g className="rvg-pass rvg-dim">
        <circle cx="61" cy="30" r="2.6" />
        <circle cx="68" cy="30" r="2.6" />
        <circle cx="75" cy="30" r="2.6" />
        <circle cx="82" cy="30" r="2.6" />
      </g>
      <g className="rvg-keys">
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => (
            <rect
              key={`${r}-${c}`}
              x={46 + c * 17}
              y={42 + r * 15}
              width="14"
              height="12"
              rx="3"
            />
          ))
        )}
      </g>
      <g className="rvg-hit">
        <rect x="46" y="94" width="48" height="14" rx="7" />
      </g>
      <g className="rvg-hit-glyph">
        <path d="M66 97.5 l7 3.5 -7 3.5 z" strokeWidth="1.4" />
      </g>
      <Badge x={100} y={101} n={3} />
    </Fig>
  );
}

/* ── 번호와 비밀번호는 다른 물건이다 ──────────────────────────── */

/** 번호 = 주소. 문 앞까지 데려다줄 뿐 열지는 못한다 */
export function FigAddress() {
  return (
    <svg viewBox="0 0 96 84" className="rvg-fig rvg-fig--sm" role="img" aria-hidden="true">
      <rect className="rvg-frame" x="26" y="10" width="44" height="66" rx="4" />
      <rect className="rvg-plate" x="34" y="22" width="28" height="13" rx="2.5" />
      <text className="rvg-plate-num" x="48" y="31.5" textAnchor="middle">
        473128
      </text>
      <circle className="rvg-knob" cx="62" cy="48" r="2.6" />
      <g className="rvg-dim">
        <path className="rvg-ground" d="M10 76 h76" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** 비밀번호 = 열쇠. 이것이 있어야 열린다 */
export function FigKey() {
  return (
    <svg viewBox="0 0 96 84" className="rvg-fig rvg-fig--sm" role="img" aria-hidden="true">
      <g className="rvg-key">
        <circle cx="36" cy="40" r="13" fill="none" strokeWidth="4.5" />
        <path d="M47 40 H82" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M72 40 v9 M80 40 v7" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      </g>
      <g className="rvg-pass">
        <circle cx="30" cy="40" r="2.4" />
        <circle cx="38" cy="40" r="2.4" />
        <circle cx="30" cy="48" r="2.4" />
        <circle cx="38" cy="48" r="2.4" />
      </g>
    </svg>
  );
}
