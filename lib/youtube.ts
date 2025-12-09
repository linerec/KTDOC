export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
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

    const data = await response.json();

    return data.items?.map((item: any) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.maxres?.url
        || item.snippet.thumbnails?.high?.url
        || item.snippet.thumbnails?.medium?.url
        || item.snippet.thumbnails?.default?.url,
      publishedAt: item.snippet.publishedAt,
    })) || [];
  } catch (error) {
    console.error('Error fetching latest videos:', error);
    return [];
  }
}
