import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { readUploads } from '@/lib/r2/readUploads';
import { uploadTargetByKey } from '@/lib/r2/uploadTargets';

// Vercel 함수 바디 한도(4.5MB) 내 실효 한도 — lib/uploadLimits.ts 참조

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 파일은 브라우저에서 R2로 직접 올라온다 — 여기 오는 것은 티켓뿐이다.
    // 폴더는 클라이언트가 아니라 등록소가 정한다(임의 경로에 쓰지 못하게).
    const target = uploadTargetByKey('general', 'images')!;
    const intake = await readUploads(request, {
      target,
      userId: session?.user?.id ?? '',
      maxFiles: 1,
    });
    const result = intake.uploads[0];

    if (!result) {
      return NextResponse.json(
        { success: false, error: intake.error ?? '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: '업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}
