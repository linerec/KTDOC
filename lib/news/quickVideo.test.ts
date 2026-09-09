import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_VIDEO_FALLBACK_TITLE,
  buildQuickVideoPost,
  canonicalYouTubeUrl,
  parseYouTubeInput,
} from './quickVideo.ts';

const TZ = 'America/New_York';

test('붙여넣은 주소의 여러 모양에서 같은 ID를 뽑는다', () => {
  for (const s of [
    'https://www.youtube.com/watch?v=abc123XYZ_-',
    '  https://youtu.be/abc123XYZ_-?si=share  ',
    'https://www.youtube.com/embed/abc123XYZ_-',
    'https://m.youtube.com/watch?v=abc123XYZ_-&t=30s',
  ]) {
    assert.equal(parseYouTubeInput(s), 'abc123XYZ_-', s);
  }
});

test('유튜브가 아니거나 비어 있으면 null — 엉뚱한 게시물을 만들지 않는다', () => {
  assert.equal(parseYouTubeInput(''), null);
  assert.equal(parseYouTubeInput('   '), null);
  assert.equal(parseYouTubeInput('https://vimeo.com/12345'), null);
  assert.equal(parseYouTubeInput('그냥 글자'), null);
});

test('저장 주소는 정규형 하나 — 중복 판정과 임베드가 같은 것을 본다', () => {
  assert.equal(canonicalYouTubeUrl('abc'), 'https://www.youtube.com/watch?v=abc');
});

test('링크 하나로 만든 게시물은 영상 분류이고 바로 게시된다', () => {
  const post = buildQuickVideoPost(
    { videoId: 'abc', title: ' 2026 추석 공연 ', publishedAt: '2026-09-05T15:00:00Z' },
    { timeZone: TZ, createdBy: '원장' }
  );
  assert.equal(post.category, 'video');
  assert.equal(post.is_published, true);
  assert.equal(post.title_ko, '2026 추석 공연');
  assert.equal(
    buildQuickVideoPost({ videoId: 'a', title: '줄바꿈이\n  있는   제목', publishedAt: null }, { timeZone: TZ }).title_ko,
    '줄바꿈이 있는 제목'
  );
  assert.equal(post.title_en, null);
  assert.equal(post.youtube_url, 'https://www.youtube.com/watch?v=abc');
  assert.equal(post.created_by, '원장');
});

test('게시일은 업로드 시각을 학원 시간대 날짜로 옮긴다 — UTC로 자르면 하루가 밀린다', () => {
  // UTC 9/6 02:30 = 뉴저지 9/5 22:30 (EDT)
  const post = buildQuickVideoPost(
    { videoId: 'abc', title: 't', publishedAt: '2026-09-06T02:30:00Z' },
    { timeZone: TZ }
  );
  assert.equal(post.published_at, '2026-09-05');
});

test('업로드일을 모르면(oEmbed 폴백) 오늘 — 학원 시간대', () => {
  const now = new Date('2026-09-10T03:00:00Z'); // 뉴저지 9/9 23:00
  const post = buildQuickVideoPost(
    { videoId: 'abc', title: 't', publishedAt: null },
    { timeZone: TZ, now }
  );
  assert.equal(post.published_at, '2026-09-09');
  const bad = buildQuickVideoPost(
    { videoId: 'abc', title: 't', publishedAt: 'not-a-date' },
    { timeZone: TZ, now }
  );
  assert.equal(bad.published_at, '2026-09-09');
});

test('제목이 비어도 게시된다 — 링크가 살아 있는 것이 우선, 제목은 나중에 고친다', () => {
  const post = buildQuickVideoPost(
    { videoId: 'abc', title: '   ', publishedAt: null },
    { timeZone: TZ }
  );
  assert.equal(post.title_ko, QUICK_VIDEO_FALLBACK_TITLE);
});
