'use client';

/**
 * YouTubeLinkGuide — "링크를 어떻게 가져오나요?"를 **그림으로** 보여 준다
 *
 * 글로 적은 4단계는 읽히지 않는다. 링크를 넣는 분들은 'URL'이 무엇인지부터 낯설고,
 * 그런 분에게 줄글 안내는 한 번 더 막히는 자리일 뿐이다. 그래서 각 단계를 실제 화면
 * 모양의 그림으로 그리고, **눌러야 할 곳에 번호를 찍었다.** 글을 안 읽어도
 * "아, 저걸 누르면 되는구나"가 되게 하는 것이 이 파일의 전부다.
 *
 * 왜 진짜 캡처가 아니라 그림인가:
 *   - 유튜브 화면은 수시로 바뀐다. 캡처는 곧 거짓말이 되고, 거짓말이 된 줄 아무도 모른다.
 *   - 캡처에는 남의 영상 썸네일·유튜브 상표가 함께 찍힌다.
 *   - 무엇보다 **누를 곳을 가리킬 수 없다.** 그림은 그 한 곳만 금색으로 남기고
 *     나머지를 흐리게 둘 수 있다 — 이 안내가 필요한 이유가 바로 그 한 곳이다.
 * 대신 2026-09 실제 화면을 보고 배치·아이콘 모양을 맞췄다.
 *
 * 그림은 인라인 SVG다(요청 0건·어떤 크기에서도 또렷·두 테마 자동).
 */

import { useT } from '@/lib/i18n/useT';

interface Props {
  open?: boolean;
  onToggle?: (open: boolean) => void;
}

/* ── 그림 조각들 ───────────────────────────────────────────────── */

/** 누를 곳을 가리키는 금색 번호 */
function Badge({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g className="ytg-badge">
      <circle cx={x} cy={y} r="11" />
      <text x={x} y={y + 4.5} textAnchor="middle">
        {n}
      </text>
    </g>
  );
}

/** 모든 그림이 같은 상자(132×168)를 쓴다 — 한 줄로 늘어놓았을 때 눈이 편하다 */
function Fig({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 132 168" className="ytg-fig" role="img" aria-hidden="true">
      {children}
    </svg>
  );
}

/** 유튜브 공유 아이콘(오른쪽 위로 꺾여 나가는 화살표) */
function ShareGlyph({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 7} ${y + 6} v-3 c0-4 3-6 7-6 h5 M${x + 1} ${y - 7} l4 4 -4 4`}
      fill="none"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** ① 폰 — 영상 아래 '공유' */
function FigPhoneShare() {
  return (
    <Fig>
      <rect className="ytg-frame" x="16" y="4" width="100" height="160" rx="13" />
      <rect className="ytg-screen" x="22" y="14" width="88" height="48" rx="4" />
      <path className="ytg-play" d="M60 31 l12 7 -12 7 z" />
      <rect className="ytg-line" x="22" y="68" width="70" height="4" rx="2" />
      <rect className="ytg-line ytg-dim" x="22" y="76" width="46" height="4" rx="2" />
      <g className="ytg-dim">
        <rect className="ytg-pill" x="22" y="92" width="26" height="18" rx="9" />
        <rect className="ytg-pill" x="84" y="92" width="26" height="18" rx="9" />
      </g>
      <g className="ytg-hit">
        <rect x="52" y="92" width="28" height="18" rx="9" />
      </g>
      <g className="ytg-hit-glyph">
        <ShareGlyph x={66} y={101} />
      </g>
      <g className="ytg-dim">
        <rect className="ytg-line" x="22" y="124" width="88" height="3" rx="1.5" />
        <rect className="ytg-line" x="22" y="134" width="64" height="3" rx="1.5" />
        <rect className="ytg-line" x="22" y="144" width="78" height="3" rx="1.5" />
      </g>
      <Badge x={66} y={78} n={1} />
    </Fig>
  );
}

/** ② 폰 — 아래에서 올라온 공유창의 '링크 복사' */
function FigPhoneCopy({ label }: { label: string }) {
  return (
    <Fig>
      <rect className="ytg-frame" x="16" y="4" width="100" height="160" rx="13" />
      <g className="ytg-dim">
        <rect className="ytg-screen" x="22" y="14" width="88" height="38" rx="4" />
        <rect className="ytg-line" x="22" y="58" width="60" height="3" rx="1.5" />
      </g>
      <rect className="ytg-sheet" x="20" y="72" width="92" height="90" rx="11" />
      <rect className="ytg-line ytg-dim" x="58" y="78" width="16" height="3" rx="1.5" />
      <g className="ytg-hit">
        <circle cx="40" cy="106" r="15" />
      </g>
      <g className="ytg-hit-glyph">
        <rect x="35" y="101" width="9" height="11" rx="2" fill="none" strokeWidth="1.7" />
        <path d="M38 99 h8 v11" fill="none" strokeWidth="1.7" strokeLinecap="round" />
      </g>
      <g className="ytg-dim">
        <circle className="ytg-pill" cx="78" cy="106" r="15" />
      </g>
      <text className="ytg-cap" x="40" y="142" textAnchor="middle">
        {label}
      </text>
      <Badge x={40} y={106} n={2} />
    </Fig>
  );
}

/**
 * ③ 우리 칸 — 붙여넣기.
 * 폰 단계에서는 폰 안에, 컴퓨터 단계에서는 브라우저 안에 그린다 —
 * 한 줄의 그림이 모두 같은 기기로 이어져야 "지금 보고 있는 이 화면"으로 읽힌다.
 */
function FigPaste({
  n,
  hint,
  field,
  device,
}: {
  n: number;
  hint: string;
  field: string;
  device: 'phone' | 'browser';
}) {
  const phone = device === 'phone';
  return (
    <Fig>
      {phone ? (
        <rect className="ytg-frame" x="16" y="4" width="100" height="160" rx="13" />
      ) : (
        <rect className="ytg-frame" x="4" y="14" width="124" height="120" rx="8" />
      )}
      <g className="ytg-dim">
        {phone ? (
          <>
            <rect className="ytg-line" x="24" y="18" width="46" height="4" rx="2" />
            <rect className="ytg-line" x="24" y="142" width="84" height="3" rx="1.5" />
            <rect className="ytg-line" x="24" y="152" width="60" height="3" rx="1.5" />
          </>
        ) : (
          <>
            <rect className="ytg-line" x="12" y="24" width="60" height="4" rx="2" />
            <rect className="ytg-line" x="12" y="112" width="104" height="3" rx="1.5" />
            <rect className="ytg-line" x="12" y="122" width="72" height="3" rx="1.5" />
          </>
        )}
      </g>

      {/* 붙여넣기 말풍선 — 칸을 가리킨다 */}
      <g className="ytg-bubble">
        <rect x={phone ? 22 : 26} y="48" width="80" height="26" rx="6" />
        <path d={`M${phone ? 56 : 60} 74 l6 8 6 -8 z`} />
      </g>
      <text className="ytg-bubble-text" x={phone ? 62 : 66} y="65" textAnchor="middle">
        {hint}
      </text>

      <rect
        className="ytg-line ytg-dim"
        x={phone ? 24 : 16}
        y="90"
        width="44"
        height="4"
        rx="2"
      />
      <g className="ytg-hit">
        <rect x={phone ? 24 : 16} y="100" width={phone ? 84 : 100} height="24" rx="6" />
      </g>
      <text className="ytg-place" x={phone ? 32 : 25} y="116">
        {field}
      </text>
      <Badge x={phone ? 110 : 116} y={112} n={n} />
    </Fig>
  );
}

/** ① PC — 맨 위 주소창을 클릭하면 글자가 파랗게 선택된다 */
function FigAddressBar({ copyLabel }: { copyLabel: string }) {
  return (
    <Fig>
      <rect className="ytg-frame" x="4" y="14" width="124" height="120" rx="8" />
      <g className="ytg-dim">
        <circle className="ytg-dot" cx="15" cy="26" r="3" />
        <circle className="ytg-dot" cx="24" cy="26" r="3" />
        <circle className="ytg-dot" cx="33" cy="26" r="3" />
      </g>
      <g className="ytg-hit">
        <rect x="10" y="40" width="112" height="22" rx="11" />
      </g>
      {/* 주소가 파랗게 선택된 상태 — 이 파란색이 알아보는 단서다 */}
      <rect className="ytg-select" x="24" y="45" width="90" height="13" rx="3" />
      <text className="ytg-url" x="28" y="55">
        youtube.com/watch…
      </text>
      <g className="ytg-dim">
        <rect className="ytg-screen" x="10" y="74" width="60" height="44" rx="4" />
        <rect className="ytg-line" x="78" y="78" width="44" height="3" rx="1.5" />
        <rect className="ytg-line" x="78" y="88" width="34" height="3" rx="1.5" />
        <rect className="ytg-line" x="78" y="98" width="40" height="3" rx="1.5" />
      </g>
      <g className="ytg-key">
        <rect x="26" y="140" width="80" height="24" rx="5" />
      </g>
      <text className="ytg-key-text" x="66" y="156" textAnchor="middle">
        {copyLabel}
      </text>
      <Badge x={14} y={51} n={1} />
    </Fig>
  );
}

/* ── 안내 본체 ─────────────────────────────────────────────────── */

export default function YouTubeLinkGuide({ open, onToggle }: Props) {
  const t = useT();

  return (
    <details
      className="yt-guide"
      open={open}
      onToggle={(e) => onToggle?.((e.target as HTMLDetailsElement).open)}
    >
      <summary className="yt-guide-summary">
        {t('admin.youtube.guide.open', '링크를 어떻게 가져오나요?')}
      </summary>

      <div className="yt-guide-body">
        <p className="yt-guide-lead">
          {t(
            'admin.youtube.guide.lead',
            '유튜브에서 복사한 것을 그대로 붙여넣으시면 됩니다. 주소 모양은 신경 쓰지 않으셔도 됩니다.'
          )}
        </p>

        <section className="ytg-row">
          <h4 className="ytg-row-title">{t('admin.youtube.guide.phone', '휴대폰 · 태블릿')}</h4>
          <ol className="ytg-steps">
            <li className="ytg-step">
              <FigPhoneShare />
              <span className="ytg-step-text">
                {t('admin.youtube.guide.s1', '영상 아래 ‘공유’')}
              </span>
            </li>
            <li className="ytg-step">
              <FigPhoneCopy label={t('admin.youtube.guide.copyIcon', '링크 복사')} />
              <span className="ytg-step-text">
                {t('admin.youtube.guide.s2', '‘링크 복사’')}
              </span>
            </li>
            <li className="ytg-step">
              <FigPaste
                n={3}
                device="phone"
                hint={t('admin.youtube.guide.pasteBubble', '붙여넣기')}
                field={t('admin.youtube.placeholder', '여기에 붙여넣기')}
              />
              <span className="ytg-step-text">
                {t('admin.youtube.guide.s3', '이 칸에 붙여넣기')}
              </span>
            </li>
          </ol>
        </section>

        <section className="ytg-row">
          <h4 className="ytg-row-title">{t('admin.youtube.guide.pc', '컴퓨터')}</h4>
          <ol className="ytg-steps">
            <li className="ytg-step">
              <FigAddressBar copyLabel="Ctrl + C" />
              <span className="ytg-step-text">
                {t('admin.youtube.guide.s4', '맨 위 주소창을 클릭')}
              </span>
            </li>
            <li className="ytg-step">
              <FigPaste
                n={2}
                device="browser"
                hint="Ctrl + V"
                field={t('admin.youtube.placeholder', '여기에 붙여넣기')}
              />
              <span className="ytg-step-text">
                {t('admin.youtube.guide.s5', '이 칸에 붙여넣기')}
              </span>
            </li>
          </ol>
        </section>

        <p className="yt-guide-note">
          {t(
            'admin.youtube.guide.note',
            '쇼츠(세로 영상)도 그대로 됩니다. 붙여넣으면 아래에 영상이 나타납니다 — 그 영상이 맞는지만 확인해 주세요.'
          )}
        </p>
      </div>
    </details>
  );
}
