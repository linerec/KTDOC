/**
 * 알림 가이드 삽화 — 글자 없는 그림들
 *
 * 실제 화면을 찍은 사진(스크린샷)이 아니라 선으로 그린 그림이다. 이유가 있다:
 *  - 여기서 보여줘야 할 장면 대부분(아이폰 공유 시트, 브라우저 권한 팝업)은
 *    브라우저가 아니라 운영체제가 그리는 것이라 우리가 찍을 수 없다.
 *  - 사진은 언어·테마마다 따로 찍어야 하고 문구가 한 번 바뀌면 바로 낡는다.
 *    그림은 currentColor를 따라 두 테마에 맞춰지고, 글자는 바깥 HTML에 있어
 *    한국어·영어가 그대로 붙는다.
 *
 * 그래서 그림 안에는 글자를 넣지 않는다(넣으면 번역이 안 된다). 회색 막대는
 * '글이 있는 자리'라는 뜻이고, 금색은 '지금 눌러야 하는 곳'이라는 뜻이다.
 */

const GOLD = 'var(--soft-gold-text)';

/** 공통 선 그리기 설정 — 낱개로 반복하지 않도록 묶어 둔다. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** 글이 있는 자리를 뜻하는 회색 막대. */
function TextBar({ x, y, w, h = 3 }: { x: number; y: number; w: number; h?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="currentColor" opacity="0.28" />;
}

/** 잠금화면에 알림이 하나 떠 있는 휴대폰 — "알림이 뭔가요"의 그림. */
export function ArtPhoneNotice() {
  return (
    <svg viewBox="0 0 120 96" className="push-guide-art" role="presentation">
      {/* 휴대폰 */}
      <rect x="34" y="6" width="52" height="84" rx="8" {...stroke} />
      <path d="M52 6h16" {...stroke} />
      {/* 화면 위에 뜬 알림 카드 */}
      <rect x="40" y="26" width="40" height="22" rx="5" fill="currentColor" opacity="0.1" />
      <rect x="40" y="26" width="40" height="22" rx="5" {...stroke} stroke={GOLD} />
      <circle cx="47" cy="34" r="3" fill={GOLD} />
      <TextBar x={53} y={32} w={22} />
      <TextBar x={53} y={38} w={16} />
      {/* 알림이 도착했다는 표시 — 카드에서 퍼지는 파동 */}
      <path d="M92 30a10 10 0 0 1 0 14M98 26a16 16 0 0 1 0 22" {...stroke} stroke={GOLD} opacity="0.7" />
    </svg>
  );
}

/** 사파리 아래쪽 공유 버튼(네모에서 위로 나가는 화살표) — 아이폰 1단계. */
export function ArtShare() {
  return (
    <svg viewBox="0 0 40 40" className="push-guide-step-art" role="presentation">
      <rect x="10" y="17" width="20" height="17" rx="3" {...stroke} stroke={GOLD} />
      <path d="M20 25V7M14 13l6-6 6 6" {...stroke} stroke={GOLD} />
    </svg>
  );
}

/** 홈 화면에 아이콘이 하나 새로 생긴 모습 — 아이폰 2단계. */
export function ArtAddHome() {
  return (
    <svg viewBox="0 0 40 40" className="push-guide-step-art" role="presentation">
      <rect x="6" y="7" width="12" height="12" rx="3" fill="currentColor" opacity="0.18" />
      <rect x="22" y="7" width="12" height="12" rx="3" fill="currentColor" opacity="0.18" />
      <rect x="6" y="23" width="12" height="12" rx="3" fill="currentColor" opacity="0.18" />
      {/* 새로 추가된 자리 — 금색 테두리와 + */}
      <rect x="22" y="23" width="12" height="12" rx="3" {...stroke} stroke={GOLD} />
      <path d="M28 26.5v5M25.5 29h5" {...stroke} stroke={GOLD} />
    </svg>
  );
}

/** 눌러야 하는 노란 버튼(종 모양) — 우리 화면의 '알림 켜기'. */
export function ArtTapBell() {
  return (
    <svg viewBox="0 0 40 40" className="push-guide-step-art" role="presentation">
      <rect x="4" y="12" width="32" height="16" rx="8" fill={GOLD} opacity="0.22" />
      <rect x="4" y="12" width="32" height="16" rx="8" {...stroke} stroke={GOLD} />
      {/* 종은 카드 아이콘과 같은 모양을 줄여 쓴다 — 직접 그리면 쓰레기통처럼 보인다.
          (갓 + 벌어진 아랫단 + 추. 아랫단이 벌어지지 않으면 종으로 안 읽힌다.) */}
      <g transform="translate(13.4 13.9) scale(0.55)" {...stroke} stroke={GOLD}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </g>
    </svg>
  );
}

/** 브라우저가 띄우는 권한 팝업 — '허용' 쪽이 금색. */
export function ArtAllow() {
  return (
    <svg viewBox="0 0 40 40" className="push-guide-step-art" role="presentation">
      <rect x="4" y="9" width="32" height="22" rx="4" {...stroke} />
      <TextBar x={9} y={14} w={18} />
      <TextBar x={9} y={19} w={12} />
      {/* 두 버튼 중 왼쪽(허용)이 눌러야 할 쪽 */}
      <rect x="9" y="23.5" width="11" height="5" rx="2.5" fill={GOLD} />
      <rect x="22" y="23.5" width="9" height="5" rx="2.5" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

/** 휴대폰과 컴퓨터 — "기기마다 따로 켜야 한다"는 그림. */
export function ArtDevices() {
  return (
    <svg viewBox="0 0 96 48" className="push-guide-art push-guide-art--wide" role="presentation">
      {/* 휴대폰 — 켜짐(금색 체크) */}
      <rect x="6" y="8" width="22" height="34" rx="4" {...stroke} />
      <circle cx="17" cy="25" r="6" fill={GOLD} opacity="0.2" />
      <path d="m14 25 2.2 2.2L20 23" {...stroke} stroke={GOLD} />
      {/* 컴퓨터 — 아직 안 켬(회색 점선 자리) */}
      <rect x="44" y="10" width="42" height="26" rx="3" {...stroke} />
      <path d="M38 40h54" {...stroke} />
      <circle cx="65" cy="23" r="6" {...stroke} strokeDasharray="2.5 2.5" opacity="0.55" />
    </svg>
  );
}
