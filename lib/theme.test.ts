/**
 * lib/theme.test.ts — 테마 판정 규칙의 진리표
 *
 * 이 규칙이 틀어지면 화면에서만 조용히 드러난다(빌드도 타입체크도 통과한다).
 * 특히 다음 회귀를 여기서 잡는다:
 *  - 콘솔에서 공개 사이트로 나올 때 상태바가 먹빛으로 되돌아감
 *  - /admin에서 공개 속성이 함께 붙어 두 CSS 블록이 작성 순서로 다툼
 *  - 저장값이 없을 때 다크로 그려짐(기본값은 라이트)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEME_ATTR,
  THEME_COLOR,
  THEME_STORAGE_KEY,
  buildThemeBootScript,
  isAdminPath,
  resolveTheme,
  themeFromPreference,
  themeScopeForPath,
} from './theme.ts';

test('저장값이 정확히 dark일 때만 다크 — 그 밖은 전부 라이트', () => {
  assert.equal(themeFromPreference('dark'), 'dark');
  assert.equal(themeFromPreference('light'), 'light');
  assert.equal(themeFromPreference(null), 'light');
  assert.equal(themeFromPreference(undefined), 'light');
  assert.equal(themeFromPreference(''), 'light');
  // 대소문자·공백을 봐주지 않는 것이 의도다 — 규칙이 하나여야 예외가 안 생긴다
  assert.equal(themeFromPreference('DARK'), 'light');
  assert.equal(themeFromPreference(' dark'), 'light');
  assert.equal(themeFromPreference('쓰레기값'), 'light');
});

test('경로가 영역을 정한다 — /admin과 그 하위만 콘솔', () => {
  assert.equal(isAdminPath('/admin'), true);
  assert.equal(isAdminPath('/admin/members'), true);
  assert.equal(isAdminPath('/'), false);
  assert.equal(isAdminPath('/about'), false);
  // 접두사만 같고 콘솔이 아닌 경로에 속으면 안 된다
  assert.equal(isAdminPath('/administrator'), false);
  assert.equal(isAdminPath('/adminish'), false);
  assert.equal(themeScopeForPath('/admin/seo'), 'admin');
  assert.equal(themeScopeForPath('/gallery'), 'site');
});

test('진리표 — 경로 2 × 콘솔 선호 3 × 사이트 선호 3', () => {
  const prefs = [null, 'light', 'dark'] as const;
  const paths = ['/', '/admin'] as const;

  for (const path of paths) {
    for (const adminPref of prefs) {
      for (const sitePref of prefs) {
        const r = resolveTheme(path, adminPref, sitePref);
        const onAdmin = path === '/admin';
        const own = onAdmin ? adminPref : sitePref;

        assert.equal(r.scope, onAdmin ? 'admin' : 'site');
        assert.equal(r.theme, own === 'dark' ? 'dark' : 'light');
        // 자기 영역 속성만 찍고 반대편은 지운다 — 공존하면 CSS 작성 순서가 승자를 정한다
        assert.equal(r.attr, onAdmin ? THEME_ATTR.admin : THEME_ATTR.site);
        assert.equal(r.clearAttr, onAdmin ? THEME_ATTR.site : THEME_ATTR.admin);
        assert.notEqual(r.attr, r.clearAttr);
        assert.equal(r.themeColor, THEME_COLOR[r.theme]);
      }
    }
  }
});

test('영역은 서로 간섭하지 않는다', () => {
  // 공개가 다크여도 콘솔은 자기 선호(기본 라이트)를 따른다
  assert.equal(resolveTheme('/admin', null, 'dark').theme, 'light');
  // 콘솔이 다크여도 공개는 자기 선호(기본 라이트)를 따른다
  assert.equal(resolveTheme('/', 'dark', null).theme, 'light');
});

test('콘솔에서 공개로 나오면 상태바가 공개 선호로 돌아간다', () => {
  // 회귀 방지: 예전에는 공개 상태바가 상수 #0a0a0a로 고정돼 있어,
  // 라이트 선호 사용자가 콘솔을 나올 때마다 상태바만 먹빛으로 되돌아갔다.
  const inConsole = resolveTheme('/admin', null, null);
  const backOnSite = resolveTheme('/', null, null);
  assert.equal(inConsole.themeColor, THEME_COLOR.light);
  assert.equal(backOnSite.themeColor, THEME_COLOR.light);

  const darkSiteUser = resolveTheme('/', null, 'dark');
  assert.equal(darkSiteUser.themeColor, THEME_COLOR.dark);
});

test('부트 스크립트는 상수로부터 생성된다 — 손으로 쓴 값과 어긋날 수 없다', () => {
  const script = buildThemeBootScript();
  for (const v of [
    THEME_STORAGE_KEY.site,
    THEME_STORAGE_KEY.admin,
    THEME_ATTR.site,
    THEME_ATTR.admin,
    THEME_COLOR.light,
    THEME_COLOR.dark,
  ]) {
    assert.ok(script.includes(v), `부트 스크립트에 ${v}가 없다`);
  }
  // 첫 페인트 전에 끝나야 하므로 즉시 실행 함수여야 한다
  assert.ok(script.startsWith('(function(){'));
  assert.ok(script.endsWith('})()'));
  // 반대편 속성을 반드시 지운다
  assert.ok(script.includes('removeAttribute'));
  // localStorage 접근은 반드시 try로 감싼다(프라이빗 모드에서 던진다)
  assert.ok(script.includes('try{'));
});
