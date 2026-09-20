/**
 * videoUrl — 선생님이 어떤 모양으로 가져오든 받아들이는가
 *
 * 이 시험의 목록은 상상이 아니다. 유튜브 앱·PC 주소창·카톡 전달·퍼가기 코드가
 * 실제로 만들어 내는 모양들이고, 쇼츠 주소를 거절해 "유효하지 않은 YouTube URL입니다"만
 * 보여 준 사고(2026-09-20)가 이 파일이 생긴 이유다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYouTube,
  parseYouTubeRef,
  extractYouTubeId,
  canonicalYouTubeUrl,
  youtubeEmbedUrl,
  isShortUrl,
} from './videoUrl.ts';

const ID = 'rmJT8M_Yk3U'; // 산수풍류 특강 Highlights (실제 쇼츠)

// ============================================================
// 받아들여야 하는 모양
// ============================================================

const ACCEPTED: [string, string][] = [
  ['PC 주소창', `https://www.youtube.com/watch?v=${ID}`],
  ['스킴 없음', `www.youtube.com/watch?v=${ID}`],
  ['www 없음', `https://youtube.com/watch?v=${ID}`],
  ['앱 공유(youtu.be + si)', `https://youtu.be/${ID}?si=Ab3dEf9`],
  ['youtu.be 단순', `https://youtu.be/${ID}`],
  ['모바일 웹', `https://m.youtube.com/watch?v=${ID}`],
  ['유튜브 뮤직', `https://music.youtube.com/watch?v=${ID}`],
  ['시간 지정', `https://www.youtube.com/watch?v=${ID}&t=617s`],
  ['재생목록 안의 영상', `https://www.youtube.com/watch?v=${ID}&list=PL123&index=2`],
  ['앱 파라미터', `https://www.youtube.com/watch?app=desktop&v=${ID}`],
  ['퍼가기 주소', `https://www.youtube.com/embed/${ID}`],
  ['퍼가기 주소(nocookie)', `https://www.youtube-nocookie.com/embed/${ID}?start=30`],
  ['라이브였던 영상', `https://www.youtube.com/live/${ID}`],
  ['옛 /v/ 주소', `https://www.youtube.com/v/${ID}`],
  ['퍼가기 코드 통째로', `<iframe width="560" height="315" src="https://www.youtube.com/embed/${ID}" title="YouTube video player" frameborder="0" allowfullscreen></iframe>`],
  ['카톡에서 옮겨 와 제목이 붙음', `산수풍류 특강 Highlights https://youtu.be/${ID}?si=xyz`],
  ['앞뒤 공백·줄바꿈', `\n  https://youtu.be/${ID}  \n`],
  ['ID만', ID],
];

for (const [label, input] of ACCEPTED) {
  test(`받는다 — ${label}`, () => {
    assert.equal(parseYouTubeRef(input)?.videoId, ID, input);
  });
}

// ============================================================
// 쇼츠 — 세로 영상임을 기억해야 한다
// ============================================================

test('쇼츠 주소를 받는다 (예전 파서가 거절하던 바로 그 모양)', () => {
  const r = parseYouTubeRef(`https://youtube.com/shorts/${ID}`);
  assert.equal(r?.videoId, ID);
  assert.equal(r?.isShort, true);
});

test('쇼츠 주소에 붙는 ?si= 도 받는다', () => {
  const r = parseYouTubeRef(`https://www.youtube.com/shorts/${ID}?si=AbC-1`);
  assert.equal(r?.videoId, ID);
  assert.equal(r?.isShort, true);
});

test('같은 영상이라도 watch 주소로 가져오면 세로로 보지 않는다', () => {
  assert.equal(parseYouTubeRef(`https://www.youtube.com/watch?v=${ID}`)?.isShort, false);
});

test('정규 주소는 쇼츠를 쇼츠로 남긴다 — 비율의 유일한 근거다', () => {
  assert.equal(canonicalYouTubeUrl(ID, true), `https://www.youtube.com/shorts/${ID}`);
  assert.equal(canonicalYouTubeUrl(ID, false), `https://www.youtube.com/watch?v=${ID}`);
  assert.equal(isShortUrl(canonicalYouTubeUrl(ID, true)), true);
  assert.equal(isShortUrl(canonicalYouTubeUrl(ID, false)), false);
  assert.equal(isShortUrl(null), false);
});

// ============================================================
// 거절 — 이유까지 말한다
// ============================================================

test('빈 입력', () => {
  assert.deepEqual(parseYouTube('   '), { ok: false, reason: 'empty' });
});

test('유튜브가 아닌 주소', () => {
  assert.deepEqual(parseYouTube('https://vimeo.com/123456'), { ok: false, reason: 'notYouTube' });
});

test('가짜 유튜브 도메인은 받지 않는다', () => {
  assert.equal(parseYouTubeRef(`https://youtube.com.evil.example/watch?v=${ID}`), null);
  assert.equal(parseYouTubeRef(`https://notyoutube.com/watch?v=${ID}`), null);
});

test('재생목록은 영상이 아니다 — 그렇게 말한다', () => {
  assert.deepEqual(parseYouTube('https://www.youtube.com/playlist?list=PLabc'), {
    ok: false,
    reason: 'playlist',
  });
  assert.deepEqual(parseYouTube('https://www.youtube.com/embed/videoseries?list=PLabc'), {
    ok: false,
    reason: 'playlist',
  });
});

test('채널 주소도 영상이 아니다', () => {
  assert.deepEqual(parseYouTube('https://www.youtube.com/@ktdoc1737'), {
    ok: false,
    reason: 'channel',
  });
  assert.deepEqual(parseYouTube('https://www.youtube.com/channel/UC12345'), {
    ok: false,
    reason: 'channel',
  });
});

test('11글자 영단어를 영상 ID로 오해하지 않는다', () => {
  assert.equal(parseYouTubeRef('performance'), null);
  assert.equal(parseYouTubeRef('celebration'), null);
});

test('길이가 안 맞는 ID는 거절한다', () => {
  assert.equal(parseYouTubeRef('https://www.youtube.com/watch?v=tooshort'), null);
  assert.equal(parseYouTubeRef('https://youtu.be/waytoolongvideoid123'), null);
});

// ============================================================
// 옛 이름 호환 — 기존 호출부가 그대로 돈다
// ============================================================

test('extractYouTubeId는 예전과 같은 계약이다', () => {
  assert.equal(extractYouTubeId(`https://www.youtube.com/watch?v=${ID}`), ID);
  assert.equal(extractYouTubeId('쓰레기'), null);
  assert.equal(extractYouTubeId(''), null);
});

test('퍼가기 주소는 추적 쿠키 없는 도메인을 쓴다', () => {
  const url = youtubeEmbedUrl(ID);
  assert.ok(url.startsWith('https://www.youtube-nocookie.com/embed/' + ID));
  assert.ok(url.includes('rel=0'));
  assert.ok(youtubeEmbedUrl(ID, { autoplay: true }).includes('autoplay=1'));
  assert.ok(youtubeEmbedUrl(ID, { start: 30 }).includes('start=30'));
});
