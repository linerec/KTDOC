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
