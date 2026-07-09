/**
 * Admin Supply Image Upload (준비물 사진/아이콘)
 * POST /api/admin/supplies/upload - 이미지 업로드 → { key, url } 반환
 * 범용 /api/upload와 달리 운영진(teacher·admin) 모두 허용한다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { uploadToR2 } from '@/lib/r2';
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB } from '@/lib/uploadLimits';

// Vercel 함수 바디 한도(4.5MB) 내 실효 한도 — lib/uploadLimits.ts 참조
const MAX_FILE_SIZE = MAX_UPLOAD_FILE_BYTES;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: '파일이 필요합니다.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '지원하지 않는 파일 형식입니다. (JPEG, PNG, GIF, WebP, SVG)' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: `파일 크기가 ${MAX_UPLOAD_FILE_MB}MB를 초과합니다.` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToR2(buffer, file.name, 'supplies');
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Supply image upload error:', error);
    return NextResponse.json({ success: false, error: '업로드에 실패했습니다.' }, { status: 500 });
  }
}
