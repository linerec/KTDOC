/**
 * lib/theme.ts — 라이트/다크 테마의 단일 소스
 *
 * 이 앱에는 테마 영역(scope)이 둘 있고, 서로 독립적인 선호를 갖는다.
 *  - site : 공개 사이트. 기본 라이트(한지). 저장 키 'site-theme'
 *  - admin: 관리 콘솔. 기본 라이트.       저장 키 'admin-theme'
 *
 * 두 영역의 판정 규칙은 같다 — **저장값이 정확히 'dark'일 때만 다크**,
 * 그 밖(없음·빈 값·쓰레기값)은 전부 라이트. 규칙이 하나라 예외가 생기지 않는다.
 *
 * ── 왜 클라이언트에서만 결정하는가 ────────────────────────────────────
 * 공개 페이지 HTML은 ISR(app/page.tsx의 revalidate)과 서비스워커 캐시를 통해
 * 모든 방문자가 공유한다. 서버가 쿠키를 읽어 테마를 렌더하면 첫 사용자의 테마가
 * 캐시에 굳어 다른 사람에게 서빙된다. 그래서 서버 HTML에는 테마 흔적이 없고,
 * layout의 <head> 안 **동기 인라인 부트 스크립트**가 첫 페인트 전에 속성을 찍는다.
 * 동기 스크립트라 페인트보다 먼저 끝나므로 깜빡임(FOUC)은 발생하지 않는다.
 *
 * ── 속성은 항상 하나만 ────────────────────────────────────────────────
 * html[data-admin-theme='light']와 html[data-site-theme='light']는 특이도가
 * 같고(0,2,0) 같은 토큰을 뒤집는다. 둘이 <html>에 공존하면 승자를 CSS 작성
 * 순서가 정하는 취약 구조가 된다. applyThemeToDocument()가 한쪽을 찍을 때
 * 반대쪽을 반드시 지워 공존 자체를 구조적으로 막는다.
 *
 * ── '있음/없음'이 아니라 '값'을 찍는 이유 ─────────────────────────────
 * 두 속성 모두 'light' | 'dark'를 명시적으로 찍는다. 그래야 **속성이 없다 =
 * 스크립트가 돌지 않았다(JS 비활성)** 가 의미를 갖고, globals.css가 그 경우를
 * 라이트로 폴백시킬 수 있다.
 */

export type Theme = 'light' | 'dark';
export type ThemeScope = 'site' | 'admin';

/** localStorage 키. 두 영역이 서로 간섭하지 않도록 분리돼 있다. */
export const THEME_STORAGE_KEY: Record<ThemeScope, string> = {
  site: 'site-theme',
  admin: 'admin-theme',
};

/** <html>에 찍는 속성 이름. globals.css의 테마 오버라이드 셀렉터와 짝 — 함께 바꿀 것. */
export const THEME_ATTR: Record<ThemeScope, string> = {
  site: 'data-site-theme',
  admin: 'data-admin-theme',
};

/** 상태바(iOS standalone)·브라우저 크롬 색. 두 영역이 같은 팔레트를 쓴다. */
export const THEME_COLOR: Record<Theme, string> = {
  light: '#f6f1e6',
  dark: '#0a0a0a',
};

/** 저장된 선호가 없을 때의 테마. 공개·콘솔 모두 라이트. */
export const DEFAULT_THEME: Theme = 'light';

export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function themeScopeForPath(pathname: string): ThemeScope {
  return isAdminPath(pathname) ? 'admin' : 'site';
}

/** 저장 문자열 → 테마. 'dark'만 다크. 대소문자·공백을 봐주지 않는 것이 의도다. */
export function themeFromPreference(raw: string | null | undefined): Theme {
  return raw === 'dark' ? 'dark' : DEFAULT_THEME;
}

export interface ResolvedTheme {
  scope: ThemeScope;
  theme: Theme;
  /** 이번에 찍어야 할 속성 */
  attr: string;
  /** 지워야 할 반대편 속성 */
  clearAttr: string;
  themeColor: string;
}

/**
 * 경로와 두 선호값으로 지금 화면에 적용할 테마를 정한다.
 * 부트 스크립트·프로바이더·테스트가 모두 이 한 함수의 규칙을 공유한다.
 */
export function resolveTheme(
  pathname: string,
  adminPreference: string | null | undefined,
  sitePreference: string | null | undefined
): ResolvedTheme {
  const scope = themeScopeForPath(pathname);
  const other: ThemeScope = scope === 'admin' ? 'site' : 'admin';
  const theme = themeFromPreference(scope === 'admin' ? adminPreference : sitePreference);
  return {
    scope,
    theme,
    attr: THEME_ATTR[scope],
    clearAttr: THEME_ATTR[other],
    themeColor: THEME_COLOR[theme],
  };
}

/**
 * <head>에 인라인으로 심을 부트 스크립트. 첫 페인트 전에 동기 실행되어야 한다
 * (defer/async 금지). 위 상수들로부터 생성하므로 값이 어긋날 수 없다.
 *
 * theme-color meta도 여기서 만들어 붙인다 — Next가 렌더한 태그를 스크립트로
 * 고치면 React가 하이드레이션에서 불일치를 보고 사본을 하나 더 만든다(태그 2개).
 * 그래서 viewport export에는 themeColor를 두지 않는다.
 */
export function buildThemeBootScript(): string {
  const A = THEME_ATTR.admin;
  const S = THEME_ATTR.site;
  return (
    '(function(){' +
    'var p=location.pathname;' +
    "var a=p==='/admin'||p.indexOf('/admin/')===0;" +
    `var k=a?'${THEME_STORAGE_KEY.admin}':'${THEME_STORAGE_KEY.site}';` +
    'var v=null;try{v=localStorage.getItem(k)}catch(e){}' +
    "var t=v==='dark'?'dark':'light';" +
    'var d=document.documentElement;' +
    `d.setAttribute(a?'${A}':'${S}',t);d.removeAttribute(a?'${S}':'${A}');` +
    "var m=document.createElement('meta');m.setAttribute('name','theme-color');" +
    `m.setAttribute('content',t==='dark'?'${THEME_COLOR.dark}':'${THEME_COLOR.light}');` +
    'document.head.appendChild(m)})()'
  );
}

/* ── 아래는 브라우저 전용 헬퍼 ──────────────────────────────────────── */

function applyThemeColor(color: string) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    // 부트 스크립트가 만들어 두지만, 차단됐을 경우를 위해 여기서도 만든다.
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

/**
 * <html>에 테마를 반영한다. 반대편 영역의 속성은 반드시 지운다 —
 * 두 테마 블록이 같은 토큰을 뒤집으므로 공존하면 CSS 작성 순서가 승자를 정한다.
 */
export function applyThemeToDocument(scope: ThemeScope, theme: Theme) {
  const root = document.documentElement;
  const other: ThemeScope = scope === 'admin' ? 'site' : 'admin';
  root.setAttribute(THEME_ATTR[scope], theme);
  root.removeAttribute(THEME_ATTR[other]);
  applyThemeColor(THEME_COLOR[theme]);
}

export function readStoredTheme(scope: ThemeScope): Theme {
  try {
    return themeFromPreference(localStorage.getItem(THEME_STORAGE_KEY[scope]));
  } catch {
    return DEFAULT_THEME;
  }
}
