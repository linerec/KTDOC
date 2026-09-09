/**
 * POST /api/admin/news/quick-video — 유튜브 링크 하나로 영상 게시물을 **바로 게시**한다
 *
 * 폼 없이 링크만 붙여넣는 길(원장님 요청, 2026-09-09). 제목·게시일은 유튜브에서
 * 가져오고(lib/youtube.ts), 무엇을 게시물로 만들지는 lib/news/quickVideo.ts가 정한다.
 * 같은 영상이 이미 있으면 새로 만들지 않고 그 게시물을 돌려준다(두 번 눌러도 하나).
 *
 * 권한은 일반 게시물 작성(/api/admin/news POST)과 같다 — 'news' 메뉴 접근.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { createNewsPost, getNewsPostByYouTubeId } from '@/lib/d1';
import { getCalendarConfig } from '@/lib/calendar';
import { getVideoMeta } from '@/lib/youtube';
import { buildQuickVideoPost, parseYouTubeInput } from '@/lib/news/quickVideo';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'news'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const raw = typeof body?.youtube_url === 'string' ? body.youtube_url : '';
    const videoId = parseYouTubeInput(raw);
    if (!videoId) {
      return NextResponse.json(
        { success: false, error: '유튜브 링크가 아닙니다. youtube.com 또는 youtu.be 주소를 붙여넣어 주세요.' },
        { status: 400 }
      );
    }

    const existing = await getNewsPostByYouTubeId(videoId);
    if (existing) {
      return NextResponse.json({
        success: true,
        data: { id: existing.id, title_ko: existing.title_ko, existing: true },
      });
    }

    const meta = await getVideoMeta(videoId);
    if (!meta) {
      return NextResponse.json(
        { success: false, error: '유튜브에서 이 영상을 찾지 못했습니다. 비공개이거나 지워진 영상일 수 있습니다.' },
        { status: 404 }
      );
    }

    const cfg = await getCalendarConfig();
    const input = buildQuickVideoPost(meta, {
      timeZone: cfg.timezone,
      createdBy: session?.user?.name || null,
    });
    const id = await createNewsPost(input);

    return NextResponse.json({
      success: true,
      data: { id, title_ko: input.title_ko, published_at: input.published_at, existing: false },
    });
  } catch (error) {
    console.error('Admin quick-video error:', error);
    return NextResponse.json(
      { success: false, error: '영상 게시물을 만들지 못했습니다.' },
      { status: 500 }
    );
  }
}
