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
import { uploadToR2 } from '@/lib/r2';
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB } from '@/lib/uploadLimits';

// Vercel 함수 바디 한도(4.5MB) 내 실효 한도 — lib/uploadLimits.ts 참조
const MAX_FILE_SIZE = MAX_UPLOAD_FILE_BYTES;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'news'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: '업로드할 파일이 없습니다.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '이미지 파일(JPEG·PNG·WebP·GIF)만 업로드할 수 있습니다.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `파일 크기는 ${MAX_UPLOAD_FILE_MB}MB 이하여야 합니다.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToR2(buffer, file.name, 'news');

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
