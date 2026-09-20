/**
 * lib/news/quickVideo.ts — 유튜브 링크 하나로 영상 게시물을 만드는 판단
 *
 * 왜 이 파일이 있나: 영상 게시물 폼은 소식 글과 같은 폼이라 분류를 바꾸고 제목을
 * 유튜브에서 옮겨 적고 날짜를 고르고 게시를 켜야 했다. 원장님은 "링크만 붙여넣고
 * 끝"을 원하셨다(2026-09-09). 제목·날짜·썸네일은 유튜브가 이미 정해 둔 것이다.
 *
 * 이 파일은 **순수 판단만** 한다(무엇을 게시물로 만들 것인가). 유튜브 조회는
 * lib/youtube.ts, 저장은 lib/d1/news.ts, 둘을 잇는 손은 API 라우트다 —
 * 그래야 네트워크 없이 의도를 시험으로 잠글 수 있다(quickVideo.test.ts).
 */

import type { CreateNewsPostInput } from '@/types/news';
// 값 import는 상대 경로 — node --test는 '@/' 별칭을 모른다(lib/forms/correction.ts와 같은 관용구)
import { parseYouTubeRef, canonicalYouTubeUrl as canonicalUrl } from '../youtube/videoUrl.ts';
import { dayInTimeZone } from '../siteDay.ts';

export interface QuickVideoMeta {
  videoId: string;
  /** 세로 영상(쇼츠)인가 — 저장 주소의 모양을 가른다 */
  isShort?: boolean;
  /** 유튜브 제목. 비어 있으면 자리표시 제목으로 게시한다 — 링크는 살아 있어야 한다. */
  title: string;
  /** 유튜브 업로드 시각(ISO). oEmbed 폴백처럼 모를 때는 null. */
  publishedAt: string | null;
}

export const QUICK_VIDEO_FALLBACK_TITLE = 'YouTube 영상';

/** 붙여넣은 문자열에서 영상 ID를 뽑는다. 주소가 아니거나 유튜브가 아니면 null. */
export function parseYouTubeInput(raw: string): string | null {
  return parseYouTubeRef(raw)?.videoId ?? null;
}

/**
 * 저장은 정규 주소 하나로 — 다만 **쇼츠는 쇼츠 주소로 남긴다**.
 * 세로/가로는 화면 비율을 가르는데, 그걸 아는 근거가 주소뿐이기 때문이다.
 * 중복 판정은 주소가 아니라 영상 ID로 한다(getNewsPostByYouTubeId).
 */
export function canonicalYouTubeUrl(videoId: string, isShort = false): string {
  return canonicalUrl(videoId, isShort);
}

/**
 * 유튜브 메타 → 게시물 입력. **바로 게시**한다(is_published: true) — 원장님 결정.
 *
 * - 게시일은 유튜브 업로드일을 **학원 시간대**의 날짜로 옮긴다. 서버 UTC로 자르면
 *   저녁 업로드가 다음 날짜가 된다(lib/siteDay.ts). 업로드일을 모르면 오늘.
 * - 영어 제목은 비운다. 유튜브 제목이 대개 한글이라 자동으로 생기지 않고, 공개
 *   카드는 title_en이 비면 한글로 폴백한다(NewsCard).
 * - 본문·썸네일도 비운다. 썸네일은 공개 화면이 유튜브 것으로 폴백한다.
 */
export function buildQuickVideoPost(
  meta: QuickVideoMeta,
  opts: { timeZone: string; now?: Date; createdBy?: string | null }
): CreateNewsPostInput {
  // 제목은 한 줄로 — 줄바꿈·연속 공백은 목록 셀에서 모양만 흐트러뜨린다.
  const title = meta.title.replace(/\s+/g, ' ').trim() || QUICK_VIDEO_FALLBACK_TITLE;
  const uploaded = meta.publishedAt ? new Date(meta.publishedAt) : null;
  const when = uploaded && !Number.isNaN(uploaded.getTime()) ? uploaded : (opts.now ?? new Date());

  return {
    category: 'video',
    title_ko: title,
    title_en: null,
    youtube_url: canonicalYouTubeUrl(meta.videoId, meta.isShort ?? false),
    published_at: dayInTimeZone(when, opts.timeZone),
    is_published: true,
    created_by: opts.createdBy ?? null,
  };
}
