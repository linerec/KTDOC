/**
 * lib/youtube/audit.ts — 사이트에 걸린 유튜브 영상이 아직 재생되는가
 *
 * **왜 필요한가.** 유튜브에서 '퍼가기 허용'을 끄거나 영상을 지우면, 우리 쪽 링크는
 * 멀쩡해 보인다. 관리 화면에서도 제목과 썸네일이 그대로 나온다. 달라지는 것은
 * **방문자 화면 하나뿐**이다 — 거기에만 "동영상을 재생할 수 없습니다"가 뜬다.
 * 올린 사람은 끝까지 모른다. 실제로 공연 영상 하나가 그 상태로 남아 있었고,
 * 49건을 손으로 훑어보기 전에는 아무도 몰랐다(2026-09-20).
 *
 * 그래서 사람이 기억해서 확인하는 대신, **시스템이 먼저 말하게** 한다.
 * 영상이 걸리는 자리는 셋이다(공연·뉴스·말모이). 셋을 모아 유튜브에 **한 번** 묻는다.
 *
 * 고치는 일은 유튜브에서만 된다 — 그래서 결과에 스튜디오 편집 주소를 함께 준다.
 */

import { queryD1 } from '@/lib/d1/client';
import { checkYouTubeVideos } from '@/lib/youtube';
import { parseYouTubeRef, youtubeThumbnail } from './videoUrl';

export type VideoProblem =
  /** 유튜브에서 '퍼가기 허용'이 꺼졌다 — 원장님이 스튜디오에서 켜면 바로 살아난다 */
  | 'notEmbeddable'
  /** 유튜브에서 지워졌거나 비공개가 됐다 — 되살릴 수 없으면 링크를 바꿔야 한다 */
  | 'missing';

export type VideoSource = 'event' | 'news' | 'song';

export interface AuditedVideo {
  videoId: string;
  /** 우리가 붙여 둔 제목(없으면 유튜브 제목) */
  title: string;
  thumbnail: string;
  /** 이 영상이 걸려 있는 자리 */
  source: VideoSource;
  sourceTitle: string;
  /** 고치러 가는 관리 화면 */
  adminHref: string;
  /** 지금 방문자에게 보이는가 — 급한 정도를 가른다 */
  isLive: boolean;
  problem: VideoProblem | null;
}

export interface YouTubeAudit {
  /** 유튜브에 물어볼 수 있었나(Data API 키가 없으면 판단하지 않는다) */
  checked: boolean;
  items: AuditedVideo[];
  problems: AuditedVideo[];
  /** 그중 지금 공개 중이라 방문자가 보고 있는 것 */
  liveProblems: AuditedVideo[];
}

interface Row {
  video_id: string;
  title: string;
  source: VideoSource;
  source_title: string;
  admin_href: string;
  is_live: number;
}

/** 세 자리에서 영상을 모은다. 주소에서 ID를 못 뽑는 행은 애초에 재생될 수 없으므로 뺀다. */
async function collect(): Promise<Row[]> {
  const [eventRows, newsRows, songRows] = await Promise.all([
    queryD1<{
      youtube_url: string;
      youtube_id: string;
      title: string | null;
      event_id: number;
      event_title: string;
      is_published: number;
    }>(
      `SELECT v.youtube_url, v.youtube_id, v.title, v.event_id,
              e.title_ko AS event_title, e.is_published
       FROM event_videos v JOIN events e ON e.id = v.event_id
       ORDER BY e.is_published DESC, v.id DESC`
    ),
    queryD1<{ id: number; title_ko: string; youtube_url: string; is_published: number }>(
      `SELECT id, title_ko, youtube_url, is_published FROM news_posts
       WHERE youtube_url IS NOT NULL AND youtube_url != '' ORDER BY id DESC`
    ),
    queryD1<{ id: number; title_ko: string; youtube_url: string; is_published: number }>(
      `SELECT id, title_ko, youtube_url, is_published FROM glossary_songs
       WHERE youtube_url IS NOT NULL AND youtube_url != '' ORDER BY id DESC`
    ),
  ]);

  const rows: Row[] = [];

  for (const r of eventRows) {
    const id = r.youtube_id || parseYouTubeRef(r.youtube_url)?.videoId;
    if (!id) continue;
    rows.push({
      video_id: id,
      title: r.title || '',
      source: 'event',
      source_title: r.event_title,
      admin_href: `/admin/gallery/${r.event_id}`,
      is_live: r.is_published,
    });
  }
  for (const r of newsRows) {
    const id = parseYouTubeRef(r.youtube_url)?.videoId;
    if (!id) continue;
    rows.push({
      video_id: id,
      title: r.title_ko,
      source: 'news',
      source_title: r.title_ko,
      admin_href: `/admin/news/${r.id}`,
      is_live: r.is_published,
    });
  }
  for (const r of songRows) {
    const id = parseYouTubeRef(r.youtube_url)?.videoId;
    if (!id) continue;
    rows.push({
      video_id: id,
      title: r.title_ko,
      source: 'song',
      source_title: r.title_ko,
      admin_href: `/admin/glossary/songs/${r.id}`,
      is_live: r.is_published,
    });
  }
  return rows;
}

/**
 * 전체 점검. 유튜브 조회는 50건씩 묶어 보낸다(Data API 한 번에 50개까지).
 *
 * 같은 영상이 여러 자리에 걸려 있으면 자리마다 한 줄로 나온다 — 고칠 곳이 여러 곳이기
 * 때문이다. 다만 유튜브에는 한 번만 묻는다.
 */
export async function auditYouTubeVideos(): Promise<YouTubeAudit> {
  const rows = await collect();
  const ids = [...new Set(rows.map((r) => r.video_id))];

  const status: Record<string, { found: boolean; embeddable: boolean | null; title: string }> = {};
  for (let i = 0; i < ids.length; i += 50) {
    Object.assign(status, await checkYouTubeVideos(ids.slice(i, i + 50)));
  }
  // 키가 없거나 조회가 실패하면 빈 맵이 온다. '모른다'를 '괜찮다'로 바꾸지 않는다.
  const checked = ids.length === 0 || Object.keys(status).length > 0;

  const items: AuditedVideo[] = rows.map((r) => {
    const s = status[r.video_id];
    let problem: VideoProblem | null = null;
    if (checked && s) {
      if (!s.found) problem = 'missing';
      else if (s.embeddable === false) problem = 'notEmbeddable';
    }
    return {
      videoId: r.video_id,
      title: r.title || s?.title || r.video_id,
      thumbnail: youtubeThumbnail(r.video_id, 'mq'),
      source: r.source,
      sourceTitle: r.source_title,
      adminHref: r.admin_href,
      isLive: r.is_live === 1,
      problem,
    };
  });

  // 급한 순서로: 공개 중인 고장 → 비공개 고장 → 나머지
  const problems = items
    .filter((i) => i.problem)
    .sort((a, b) => Number(b.isLive) - Number(a.isLive));

  return {
    checked,
    items,
    problems,
    liveProblems: problems.filter((p) => p.isLive),
  };
}

/**
 * 유튜브 스튜디오의 이 영상 편집 화면.
 * "스튜디오를 열고 영상을 찾아서…"가 아니라 **그 영상의 설정 화면으로 바로** 보낸다 —
 * 스스로 고칠 수 있게 하는 데 이 한 줄이 가장 크다.
 */
export function youtubeStudioEditUrl(videoId: string): string {
  return `https://studio.youtube.com/video/${videoId}/edit`;
}
