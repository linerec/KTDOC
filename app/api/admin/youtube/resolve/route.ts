/**
 * POST /api/admin/youtube/resolve — 붙여넣은 링크가 어떤 영상인지 확인해 준다
 *
 * 유튜브 링크를 넣는 화면이 네 곳이다(공연 영상·뉴스 영상·빠른 게시·말모이 노래).
 * 넷이 각자 검사하면 어느 화면은 쇼츠를 받고 어느 화면은 거절하는 상태가 된다 —
 * 실제로 그랬다. 확인은 여기 한 곳에서만 한다.
 *
 * 돌려주는 것은 화면이 **"이 영상 맞습니까?"를 그림으로 보여 주기 위한 재료**다.
 * 제목을 손으로 옮겨 적게 하지 않고, 퍼가기가 막힌 영상이면 등록 전에 말해 준다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { parseYouTube, YOUTUBE_PARSE_MESSAGES } from '@/lib/youtube/videoUrl';
import { resolveYouTubeVideo, checkYouTubeVideos } from '@/lib/youtube';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    // 일괄 점검 — 이미 등록된 영상들이 아직 퍼갈 수 있는지 한 번에 묻는다(Data API 1회).
    if (Array.isArray(body?.ids)) {
      const map = await checkYouTubeVideos(body.ids.filter((v: unknown) => typeof v === 'string'));
      return NextResponse.json({ success: true, data: map });
    }

    const raw = typeof body?.input === 'string' ? body.input : '';

    const parsed = parseYouTube(raw);
    if (!parsed.ok) {
      return NextResponse.json(
        { success: false, reason: parsed.reason, error: YOUTUBE_PARSE_MESSAGES[parsed.reason] },
        { status: 400 }
      );
    }

    const resolved = await resolveYouTubeVideo(parsed.ref.videoId, {
      hintIsShort: parsed.ref.isShort,
    });

    if ('error' in resolved) {
      return NextResponse.json(
        {
          success: false,
          reason: resolved.error,
          error:
            '유튜브에서 이 영상을 찾지 못했습니다. 비공개(일부 공개 포함)이거나 지워진 영상일 수 있습니다.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: resolved });
  } catch (error) {
    console.error('youtube resolve error:', error);
    return NextResponse.json(
      { success: false, error: '유튜브를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
