/**
 * lib/html/richText.test.ts — 붙여넣은 글이 페이지를 망가뜨리지 않는지 잠근다
 *
 * 여기가 틀리면 증상이 조용하다. 워드에서 온 서체·색이 문단에 눌어붙으면 붙여넣은
 * 사람의 테마에서는 멀쩡해 보이고, 반대 테마에서만 글자가 배경에 묻는다. 쓴 사람은
 * 자기 화면이 정상이니 끝난 줄 안다 — 그래서 눈이 아니라 시험이 봐야 한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  plainToRichText,
  richTextToPlain,
  sanitizeRichText,
  splitCrammedLines,
} from './richText.ts';

/* ── 아는 것만 남긴다 ───────────────────────────────────────────────── */

test('허용한 서식은 그대로 남는다', () => {
  const html = '<p><strong>굵게</strong>와 <em>기울임</em></p><h3>소제목</h3><ul><li>한 줄</li></ul>';
  assert.equal(sanitizeRichText(html), html);
});

test('워드가 실어 보낸 서체·색은 벗겨지고 글은 남는다', () => {
  const pasted =
    '<p><span style="font-family:Malgun Gothic; font-size:11pt; color:#333">안은희 대표는</span> 단국대학교</p>';
  assert.equal(sanitizeRichText(pasted), '<p>안은희 대표는 단국대학교</p>');
});

test('style 블록은 안에 든 것까지 통째로 사라진다', () => {
  const pasted = '<style>p { color: red }</style><p>본문</p>';
  assert.equal(sanitizeRichText(pasted), '<p>본문</p>');
});

test('script는 내용까지 사라진다', () => {
  assert.equal(sanitizeRichText('<p>가<script>alert(1)</script>나</p>'), '<p>가나</p>');
});

test('이벤트 핸들러 속성은 남지 않는다', () => {
  const out = sanitizeRichText('<p onclick="steal()">본문</p>');
  assert.equal(out, '<p>본문</p>');
});

test('금색 강조 span만 class를 지킨다', () => {
  assert.equal(
    sanitizeRichText('<p><span class="highlight">카네기홀</span></p>'),
    '<p><span class="highlight">카네기홀</span></p>'
  );
  // 페이지의 다른 컴포넌트 스타일을 글 안에서 불러다 쓰지 못하게 한다
  assert.equal(sanitizeRichText('<p><span class="admin-btn">눌러</span></p>'), '<p>눌러</p>');
});

/* ── 링크 ──────────────────────────────────────────────────────────── */

test('바깥 링크만 새 탭으로 열리고 rel이 붙는다', () => {
  assert.equal(
    sanitizeRichText('<p><a href="https://ktdoc.org">춤누리</a></p>'),
    '<p><a href="https://ktdoc.org" target="_blank" rel="noopener noreferrer">춤누리</a></p>'
  );
});

test('사이트 안 링크는 같은 탭에 남는다 — 새 탭이면 뒤로 가기가 죽는다', () => {
  assert.equal(
    sanitizeRichText('<p><a href="/performances">공연</a></p>'),
    '<p><a href="/performances">공연</a></p>'
  );
});

test('javascript: 링크는 껍데기만 벗겨지고 글자는 남는다', () => {
  assert.equal(sanitizeRichText('<p><a href="javascript:alert(1)">눌러</a></p>'), '<p>눌러</p>');
});

/* ── 마크업을 스스로 여미는가 ───────────────────────────────────────── */

test('닫히지 않은 태그를 끝에서 여민다', () => {
  assert.equal(sanitizeRichText('<p>안 닫힌 <strong>문단'), '<p>안 닫힌 <strong>문단</strong></p>');
});

test('떠도는 닫는 태그는 버린다', () => {
  assert.equal(sanitizeRichText('</div><p>본문</p></span>'), '<p>본문</p>');
});

test('문단 안에 문단이 열리면 앞 문단을 닫는다 — <p> 중첩은 무효 마크업이다', () => {
  assert.equal(sanitizeRichText('<p>첫째<p>둘째'), '<p>첫째</p><p>둘째</p>');
});

test('블록 밖으로 떠도는 글자는 문단으로 감싼다', () => {
  assert.equal(sanitizeRichText('그냥 글자'), '<p>그냥 글자</p>');
});

test('목록 밖의 <li>는 목록을 열어 받는다 — 버리면 줄이 사라진다', () => {
  assert.equal(sanitizeRichText('<li>첫 줄</li><li>둘째 줄</li>'), '<ul><li>첫 줄</li><li>둘째 줄</li></ul>');
});

test('목록 안에서는 문단이 형제 <li>를 닫지 않는다', () => {
  const html = '<ul><li>가</li><li>나</li></ul>';
  assert.equal(sanitizeRichText(html), html);
});

test('blockquote 안의 문단들은 인용을 닫지 않는다', () => {
  const html = '<blockquote><p>가</p><p>나</p></blockquote>';
  assert.equal(sanitizeRichText(html), html);
});

/* ── 빈 것과 공백 ──────────────────────────────────────────────────── */

test('빈 문단은 버린다 — 남기면 문단 사이만 두 배로 벌어진다', () => {
  assert.equal(sanitizeRichText('<p>가</p><p><br></p><p>나</p>'), '<p>가</p><p>나</p>');
});

test('빈 <li>는 남긴다 — 지우려던 줄이 아니라 아직 안 쓴 줄이다', () => {
  assert.equal(sanitizeRichText('<ul><li>가</li><li></li></ul>'), '<ul><li>가</li><li></li></ul>');
});

test('&nbsp; 엔티티도 접는다 — 워드의 text/html은 글자가 아니라 엔티티로 준다', () => {
  assert.equal(sanitizeRichText('<p>아주&nbsp;긴&nbsp;줄</p>'), '<p>아주 긴 줄</p>');
});

test('줄바꿈 없는 공백은 보통 공백이 된다 — 안 그러면 좁은 화면이 가로로 터진다', () => {
  assert.equal(sanitizeRichText('<p>아주 긴 줄</p>'), '<p>아주 긴 줄</p>');
});

test('블록 사이의 들여쓰기는 문단을 만들지 않는다', () => {
  assert.equal(sanitizeRichText('<p>가</p>\n  \n<p>나</p>'), '<p>가</p><p>나</p>');
});

/* ── 이스케이프 ────────────────────────────────────────────────────── */

test('태그가 아닌 <는 글자로 되돌린다', () => {
  assert.equal(sanitizeRichText('<p>5 < 10</p>'), '<p>5 &lt; 10</p>');
});

test('이미 엔티티인 &는 두 번 이스케이프하지 않는다', () => {
  assert.equal(sanitizeRichText('<p>Q&amp;A 와 R&D</p>'), '<p>Q&amp;A 와 R&amp;D</p>');
});

/* ── 제목 층위 ─────────────────────────────────────────────────────── */

test('워드의 제목1·제목2는 h3으로 내려앉는다 — 페이지에 이미 h1·h2가 있다', () => {
  assert.equal(sanitizeRichText('<h1>주요 무대</h1><h2>수상</h2>'), '<h3>주요 무대</h3><h3>수상</h3>');
});

test('<b>·<i>·<div>는 하나의 이름으로 모인다', () => {
  assert.equal(sanitizeRichText('<div><b>가</b><i>나</i></div>'), '<p><strong>가</strong><em>나</em></p>');
});

/* ── 옛 값 옮기기 ──────────────────────────────────────────────────── */

test('한 칸에 우겨넣은 줄들을 다시 가른다 — 화면에서는 한 줄로 이어져 보였다', () => {
  const crammed = '주트리니다드 토바고 대사관 초청공연/\n\n주온두라스 대사관 초청공연/\n\nNBC TODAY Show';
  assert.deepEqual(splitCrammedLines(crammed), [
    '주트리니다드 토바고 대사관 초청공연',
    '주온두라스 대사관 초청공연',
    'NBC TODAY Show',
  ]);
});

test('줄글은 문단들이 된다', () => {
  assert.equal(plainToRichText('첫 문단\n둘째 문단'), '<p>첫 문단</p><p>둘째 문단</p>');
});

test('옮긴 결과는 정화기를 통과해도 그대로다 — 옮기자마자 달라지면 안 된다', () => {
  const rich = plainToRichText('첫 문단\n둘째 & 셋째');
  assert.equal(sanitizeRichText(rich), rich);
});

test('글자만 남기면 블록이 붙어 한 단어가 되지 않는다', () => {
  assert.equal(richTextToPlain('<p>가</p><p>나</p>'), '가 나');
});
