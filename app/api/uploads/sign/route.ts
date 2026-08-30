/**
 * 업로드 서명 — POST /api/uploads/sign
 *
 * 화면은 "이 파일들을 저 라우트로 올릴 겁니다"라고만 말한다. 이 라우트는
 * 그 목적지(target)를 등록소에서 찾아 **목적지가 쓸 권한 판정을 그대로 돌리고**,
 * 통과하면 R2에 직접 올릴 수 있는 서명된 주소를 내준다.
 *
 * 이 라우트는 파일을 받지 않는다 — 그래서 4.5MB 본문 한도와 무관하다. 오가는
 * 것은 파일 이름·형식·크기뿐이다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createTickets, type RequestedFile } from '@/lib/r2/directUpload';
import { findUploadTarget } from '@/lib/r2/uploadTargets';

/** 한 번에 서명해 주는 최대 장수 — 화면이 나눠 부르게 한다. */
const MAX_FILES_PER_REQUEST = 40;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const payload = (await request.json().catch(() => null)) as {
      target?: unknown;
      files?: unknown;
    } | null;

    const targetPath = typeof payload?.target === 'string' ? payload.target : '';
    const target = findUploadTarget(targetPath);
    if (!target) {
      // 등록소에 없는 주소에는 서명하지 않는다 — 서명은 곧 버킷 쓰기 허가다
      return NextResponse.json(
        { success: false, error: '이 주소로는 업로드할 수 없습니다.' },
        { status: 400 }
      );
    }

    if (!(await target.authorize(session))) {
      return NextResponse.json(
        { success: false, error: '이 사진을 올릴 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const rawFiles = Array.isArray(payload?.files) ? payload.files : [];
    if (!rawFiles.length) {
      return NextResponse.json(
        { success: false, error: '올릴 파일이 없습니다.' },
        { status: 400 }
      );
    }
    if (rawFiles.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { success: false, error: `한 번에 ${MAX_FILES_PER_REQUEST}개까지 올릴 수 있습니다.` },
        { status: 400 }
      );
    }

    const files: RequestedFile[] = rawFiles.map((f) => {
      const file = (f ?? {}) as Record<string, unknown>;
      return {
        name: typeof file.name === 'string' ? file.name : '',
        type: typeof file.type === 'string' ? file.type : '',
        size: Number(file.size),
      };
    });

    const created = createTickets(target, files, session.user.id);
    if (!created.ok) {
      return NextResponse.json({ success: false, error: created.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: { tickets: await Promise.all(created.tickets) },
    });
  } catch (error) {
    console.error('업로드 서명 오류:', error);
    return NextResponse.json(
      { success: false, error: '업로드를 시작하지 못했습니다.' },
      { status: 500 }
    );
  }
}
