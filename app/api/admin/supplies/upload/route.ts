/**
 * Admin Supply Image Upload (준비물 사진/아이콘)
 * POST /api/admin/supplies/upload - 이미지 업로드 → { key, url } 반환
 * 범용 /api/upload와 달리 운영진(teacher·admin) 모두 허용한다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { readUploads } from '@/lib/r2/readUploads';
import { uploadTargetByKey } from '@/lib/r2/uploadTargets';

// Vercel 함수 바디 한도(4.5MB) 내 실효 한도 — lib/uploadLimits.ts 참조

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }

    // 파일은 브라우저에서 R2로 직접 올라온다 — 여기 오는 것은 티켓뿐이다.
    const target = uploadTargetByKey('supplies', 'supplies')!;
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
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Supply image upload error:', error);
    return NextResponse.json({ success: false, error: '업로드에 실패했습니다.' }, { status: 500 });
  }
}
