/**
 * Admin Gallery Loose Photos API
 * POST /api/admin/gallery/photos - 날짜/이벤트 미정리 사진 업로드
 * GET /api/admin/gallery/photos - 사진 보관함 목록
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { createGalleryPhoto, getGalleryPhotoById, getGalleryPhotos } from '@/lib/d1';
import { attachUploaderNames } from '@/lib/admin/galleryPhotoActions';
import { uploadToR2 } from '@/lib/r2';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '80', 10);
    const organizedParam = searchParams.get('organized');
    const publishedParam = searchParams.get('published');
    const eventIdParam = searchParams.get('eventId');
    const sortParam = searchParams.get('sort');
    const submittedParam = searchParams.get('submitted');

    const result = await getGalleryPhotos({
      page,
      limit,
      search: searchParams.get('search') || undefined,
      organized: organizedParam === 'assigned' || organizedParam === 'unassigned'
        ? organizedParam
        : 'all',
      published: publishedParam === null ? undefined : publishedParam === 'true',
      eventId: eventIdParam ? Number(eventIdParam) : undefined,
      sort: sortParam === 'oldest' || sortParam === 'taken' ? sortParam : 'recent',
      submitted: submittedParam === 'student' || submittedParam === 'staff' ? submittedParam : 'all',
    });

    result.photos = await attachUploaderNames(result.photos);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Admin loose photos fetch error:', error);
    return NextResponse.json(
      { success: false, error: '사진 보관함을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const publishNow = formData.get('publishNow') === 'true';

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: '업로드할 사진이 없습니다.' },
        { status: 400 }
      );
    }

    const uploaded = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const r2Result = await uploadToR2(buffer, filename, 'gallery/photos');

      const photoId = await createGalleryPhoto({
        image_url: r2Result.url,
        r2_key: r2Result.key,
        size: file.size,
        is_published: publishNow,
      });
      const photo = await getGalleryPhotoById(photoId);

      if (photo) uploaded.push(photo);
    }

    if (uploaded.length === 0) {
      return NextResponse.json(
        { success: false, error: '이미지 파일만 업로드할 수 있습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        photos: uploaded,
        count: uploaded.length,
      },
    });
  } catch (error) {
    console.error('Admin loose photo upload error:', error);
    return NextResponse.json(
      { success: false, error: '사진 업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}
