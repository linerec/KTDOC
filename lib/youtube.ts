export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
}

interface YouTubePlaylistItem {
  snippet: {
    title: string;
    publishedAt: string;
    resourceId: {
      videoId: string;
    };
    thumbnails?: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
      maxres?: { url: string };
    };
  };
}

interface YouTubePlaylistResponse {
  items?: YouTubePlaylistItem[];
}

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const CHANNEL_HANDLE = '@ktdoc1737';

async function getChannelId(apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=id&forHandle=${CHANNEL_HANDLE}&key=${apiKey}`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    if (!response.ok) {
      console.error('Failed to fetch channel ID:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.items?.[0]?.id || null;
  } catch (error) {
    console.error('Error fetching channel ID:', error);
    return null;
  }
}

async function getUploadsPlaylistId(apiKey: string, channelId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=contentDetails&id=${channelId}&key=${apiKey}`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      console.error('Failed to fetch uploads playlist:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
  } catch (error) {
    console.error('Error fetching uploads playlist:', error);
    return null;
  }
}

export async function getLatestVideos(maxResults: number = 3): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.error('YOUTUBE_API_KEY is not set');
    return [];
  }

  try {
    // Get channel ID from handle
    const channelId = await getChannelId(apiKey);
    if (!channelId) {
      console.error('Could not find channel ID');
      return [];
    }

    // Get uploads playlist ID
    const uploadsPlaylistId = await getUploadsPlaylistId(apiKey, channelId);
    if (!uploadsPlaylistId) {
      console.error('Could not find uploads playlist');
      return [];
    }

    // Get latest videos from uploads playlist
    const response = await fetch(
      `${YOUTUBE_API_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${apiKey}`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (!response.ok) {
      console.error('Failed to fetch videos:', response.statusText);
      return [];
    }

    const data = (await response.json()) as YouTubePlaylistResponse;

    return data.items?.map((item) => {
      const thumbnail = item.snippet.thumbnails?.maxres?.url
        || item.snippet.thumbnails?.high?.url
        || item.snippet.thumbnails?.medium?.url
        || item.snippet.thumbnails?.default?.url
        || '';

      return {
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnail,
        publishedAt: item.snippet.publishedAt,
      };
    }) || [];
  } catch (error) {
    console.error('Error fetching latest videos:', error);
    return [];
  }
}

// ============================================
// 영상 한 건의 메타 — 링크 붙여넣기로 영상 게시물을 만들 때(lib/news/quickVideo.ts)
// ============================================

export interface YouTubeVideoMeta {
  videoId: string;
  title: string;
  /** 업로드 시각(ISO). oEmbed 폴백은 이 값을 주지 않는다. */
  publishedAt: string | null;
}

/**
 * 영상 ID → 제목·업로드 시각.
 *
 * 1순위는 Data API(키 필요, 홈 히어로가 이미 쓴다) — 업로드일까지 준다.
 * 키가 없거나 실패하면 oEmbed(키 불필요)로 제목만이라도 받는다.
 * 둘 다 안 되면(비공개·삭제·존재하지 않는 ID) null — 호출부가 사람에게 말한다.
 *
 * 캐시하지 않는다: 붙여넣기 한 번에 조회 한 번이고, 제목이 방금 바뀌었을 수 있다.
 */
export async function getVideoMeta(videoId: string): Promise<YouTubeVideoMeta | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `${YOUTUBE_API_BASE}/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${apiKey}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          items?: { id: string; snippet?: { title?: string; publishedAt?: string } }[];
        };
        const item = data.items?.[0];
        if (item?.snippet) {
          return {
            videoId,
            title: item.snippet.title ?? '',
            publishedAt: item.snippet.publishedAt ?? null,
          };
        }
        // 응답은 정상인데 항목이 없다 = 없는 영상. oEmbed로 다시 물을 이유가 없다.
        return null;
      }
      console.warn('[youtube] Data API 실패, oEmbed로 전환:', res.status);
    } catch (error) {
      console.warn('[youtube] Data API 오류, oEmbed로 전환:', error);
    }
  }

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return { videoId, title: data.title ?? '', publishedAt: null };
  } catch (error) {
    console.error('[youtube] oEmbed 오류:', error);
    return null;
  }
}

// ============================================
// 붙여넣은 링크 확인 — 화면이 "이 영상 맞나요?"를 보여 주기 위한 한 번의 조회
// ============================================

/**
 * 링크 확인 결과. 모양은 lib/youtube/videoUrl.ts에 있다(클라이언트도 쓰는 타입).
 *
 * `embeddable`이 이 조회가 존재하는 절반의 이유다. 유튜브에서 '퍼가기 허용'을 꺼 둔
 * 영상은 링크는 멀쩡한데 사이트에서는 "동영상을 재생할 수 없습니다"만 나온다.
 * 등록하는 순간에 말해 주지 않으면, 올린 사람은 잘 올라갔다고 믿고 방문자만 깨진
 * 화면을 본다(실제로 공연 영상 하나가 그 상태였다 — 2026-09-20 발견).
 */
export type { ResolvedYouTubeVideo } from './youtube/videoUrl';
import type { ResolvedYouTubeVideo } from './youtube/videoUrl';

export type ResolveYouTubeFailure = 'notFound' | 'private';

/**
 * 영상 ID가 쇼츠(세로)인가 — 유튜브에 직접 물어본다.
 *
 * 유튜브 API에는 "이 영상이 쇼츠인가"라는 항목이 없다. 썸네일은 쇼츠도 16:9로 내려오고
 * 길이로도 가를 수 없다(34초짜리 가로 영상이 있고, 긴 쇼츠도 있다). 확실한 신호는
 * 하나뿐이다: `youtube.com/shorts/<ID>`를 열었을 때
 *   - 200이면 쇼츠,
 *   - 303으로 `/watch?v=`에 튕기면 일반 영상.
 * 실패하면 null(모름) — 모를 때는 가로로 둔다(기존 동작).
 */
export async function probeIsShort(videoId: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${encodeURIComponent(videoId)}`, {
      method: 'HEAD',
      redirect: 'manual',
      cache: 'no-store',
    });
    if (res.status === 200) return true;
    if (res.status >= 300 && res.status < 400) return false;
    return null;
  } catch (error) {
    console.warn('[youtube] 쇼츠 판별 실패:', error);
    return null;
  }
}

/**
 * 영상 ID → 화면에 보여 줄 모든 것(제목·채널·업로드일·썸네일·세로 여부·퍼가기 허용).
 *
 * Data API 키가 있으면 한 번에 다 받고, 없으면 oEmbed로 제목만 받는다.
 * 쇼츠 여부는 붙여넣은 주소가 이미 말해 줬으면(hintIsShort) 그대로 믿고,
 * 아니면 유튜브에 물어본다 — watch 주소로 가져온 쇼츠도 세로로 보이게 하기 위해서다.
 */
export async function resolveYouTubeVideo(
  videoId: string,
  opts: { hintIsShort?: boolean } = {}
): Promise<ResolvedYouTubeVideo | { error: ResolveYouTubeFailure }> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  let title = '';
  let channelTitle: string | null = null;
  let publishedAt: string | null = null;
  let embeddable: boolean | null = null;
  let found = false;

  if (apiKey) {
    try {
      const res = await fetch(
        `${YOUTUBE_API_BASE}/videos?part=snippet,status&id=${encodeURIComponent(videoId)}&key=${apiKey}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          items?: {
            snippet?: { title?: string; channelTitle?: string; publishedAt?: string };
            status?: { embeddable?: boolean; privacyStatus?: string };
          }[];
        };
        const item = data.items?.[0];
        if (!item) return { error: 'notFound' };
        found = true;
        title = item.snippet?.title ?? '';
        channelTitle = item.snippet?.channelTitle ?? null;
        publishedAt = item.snippet?.publishedAt ?? null;
        embeddable = item.status?.embeddable ?? null;
      } else {
        console.warn('[youtube] Data API 실패, oEmbed로 전환:', res.status);
      }
    } catch (error) {
      console.warn('[youtube] Data API 오류, oEmbed로 전환:', error);
    }
  }

  if (!found) {
    // oEmbed는 비공개·퍼가기 금지 영상을 모두 Unauthorized로 돌려준다 —
    // 둘을 가릴 수 없으므로 '찾지 못함'으로 말한다.
    const meta = await getVideoMeta(videoId);
    if (!meta) return { error: 'notFound' };
    title = meta.title;
    publishedAt = meta.publishedAt;
  }

  const isShort =
    opts.hintIsShort === true ? true : ((await probeIsShort(videoId)) ?? false);

  return {
    videoId,
    canonicalUrl: isShort
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`,
    title,
    channelTitle,
    publishedAt,
    thumbnail,
    isShort,
    embeddable,
  };
}

/** 여러 영상의 상태를 한 번에 — 이미 등록된 영상 목록을 점검할 때(Data API 1회, 최대 50건). */
export async function checkYouTubeVideos(
  videoIds: string[]
): Promise<Record<string, { found: boolean; embeddable: boolean | null; title: string }>> {
  const out: Record<string, { found: boolean; embeddable: boolean | null; title: string }> = {};
  const ids = [...new Set(videoIds.filter(Boolean))].slice(0, 50);
  if (ids.length === 0) return out;

  const apiKey = process.env.YOUTUBE_API_KEY;
  // 키가 없으면 판단하지 않는다. "모른다"를 "괜찮다"로 바꾸지 않는다.
  if (!apiKey) return out;

  try {
    const res = await fetch(
      `${YOUTUBE_API_BASE}/videos?part=snippet,status&id=${ids.map(encodeURIComponent).join(',')}&key=${apiKey}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return out;
    const data = (await res.json()) as {
      items?: { id: string; snippet?: { title?: string }; status?: { embeddable?: boolean } }[];
    };
    for (const id of ids) out[id] = { found: false, embeddable: null, title: '' };
    for (const item of data.items ?? []) {
      out[item.id] = {
        found: true,
        embeddable: item.status?.embeddable ?? null,
        title: item.snippet?.title ?? '',
      };
    }
  } catch (error) {
    console.warn('[youtube] 일괄 점검 실패:', error);
  }
  return out;
}
