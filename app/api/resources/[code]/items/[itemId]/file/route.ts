/**
 * 자료함 파일 — 재생·다운로드
 * GET /api/resources/[code]/items/[itemId]/file        재생(inline)
 * GET /api/resources/[code]/items/[itemId]/file?dl=1   저장(attachment)
 *
 * 재생과 다운로드를 한 라우트에 둔 이유는, 게이트 판정과 Range 처리가 완전히
 * 같고 다른 것은 Content-Disposition 한 줄뿐이기 때문이다. 나누면 같은 판정이
 * 두 벌이 된다.
 */

import { NextResponse } from 'next/server';
import { getItem, logAccess } from '@/lib/d1/resources';
import { isValidResourceCode } from '@/lib/resources/code';
import { clientIp, resolvePublicGate, resourceSecret } from '@/lib/resources/publicGate';
import { streamFromR2 } from '@/lib/resources/stream';
import { hashIp } from '@/lib/resources/tokens';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ code: string; itemId: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { code, itemId: rawItemId } = await params;
  if (!isValidResourceCode(code)) return new NextResponse(null, { status: 404 });

  const itemId = Number(rawItemId);
  if (!Number.isInteger(itemId) || itemId <= 0) return new NextResponse(null, { status: 404 });

  const url = new URL(request.url);
  const download = url.searchParams.get('dl') === '1';

  try {
    const { vault, verdict } = await resolvePublicGate({
      code,
      need: download ? 'download' : 'view',
      linkToken: url.searchParams.get('k'),
    });

    if (!verdict.ok) {
      // 잠긴 것과 없는 것은 상태 코드를 달리한다 — 화면이 다르게 대응해야 한다.
      // 다만 '무엇이 있는지'는 어느 쪽으로도 새지 않는다(본문이 비어 있다).
      const status =
        verdict.reason === 'locked' ? 401 : verdict.reason === 'download_denied' ? 403 : 404;
      return new NextResponse(null, { status });
    }

    const item = await getItem(vault!.id, itemId);
    if (!item) return new NextResponse(null, { status: 404 });

    const range = request.headers.get('range');

    // 구간 이동 한 번에 기록이 수십 줄 쌓이면 표를 못 읽는다 —
    // 처음 요청(Range 없음 또는 0부터)만 남긴다.
    const isFirstRequest = !range || /^bytes=0-/.test(range);
    if (isFirstRequest) {
      await logAccess({
        vaultId: vault!.id,
        code,
        action: download ? 'download' : 'play',
        itemId: item.id,
        ipHash: hashIp(clientIp(request), resourceSecret()),
        userAgent: request.headers.get('user-agent'),
        detail: item.title,
      });
    }

    return streamFromR2(item.r2Key, {
      range,
      contentType: item.contentType,
      fileName: item.fileName,
      download,
    });
  } catch (error) {
    console.error('[resources] 파일 중계 실패:', error);
    return new NextResponse(null, { status: 500 });
  }
}
