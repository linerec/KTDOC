/**
 * Admin News Thumbnail Upload API
 * POST /api/admin/news/upload - 대표 이미지 업로드 (R2 news/ 폴더)
 *
 * 폼에서 파일을 먼저 올려 {url, key}를 받고, 게시물 저장 시 함께 제출한다.
 * 교체·삭제 시 이전 객체 정리는 게시물 PUT/DELETE 핸들러가 담당한다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { readUploads } from '@/lib/r2/readUploads';
import { uploadTargetByKey } from '@/lib/r2/uploadTargets';

// Vercel 함수 바디 한도(4.5MB) 내 실효 한도 — lib/uploadLimits.ts 참조

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'news'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 파일은 브라우저에서 R2로 직접 올라온다 — 여기 오는 것은 티켓뿐이다.
    const target = uploadTargetByKey('news', 'news')!;
    const intake = await readUploads(request, {
      target,
      userId: session?.user?.id ?? '',
      maxFiles: 1,
    });
    const result = intake.uploads[0];

    if (!result) {
      return NextResponse.json(
        { success: false, error: intake.error ?? '업로드할 파일이 없습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { url: result.url, key: result.key },
    });
  } catch (error) {
    console.error('News thumbnail upload error:', error);
    return NextResponse.json(
      { success: false, error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}
