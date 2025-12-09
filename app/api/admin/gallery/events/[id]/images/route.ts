/**
 * Admin Gallery Event Images API
 * POST /api/admin/gallery/events/[id]/images - 이미지 업로드
 * DELETE /api/admin/gallery/events/[id]/images?imageId=xxx - 이미지 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getEventById, createEventImage, deleteEventImage } from '@/lib/d1';
import { uploadToR2, deleteFromR2 } from '@/lib/r2';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - 이미지 업로드
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이벤트 ID입니다.' },
        { status: 400 }
      );
    }

    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: '이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: '업로드할 파일이 없습니다.' },
        { status: 400 }
      );
    }

    const uploadedImages = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        continue; // Skip non-image files
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      // Upload to R2
      const r2Result = await uploadToR2(buffer, filename, `gallery/${eventId}`);

      // Save to database
      const imageId = await createEventImage(eventId, {
        image_url: r2Result.url,
        r2_key: r2Result.key,
        size: file.size,
      });

      uploadedImages.push({
        id: imageId,
        image_url: r2Result.url,
        r2_key: r2Result.key,
      });
    }

    return NextResponse.json({
      success: true,
      data: { images: uploadedImages, count: uploadedImages.length },
    });
  } catch (error) {
    console.error('Admin gallery image upload error:', error);
    return NextResponse.json(
      { success: false, error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - 이미지 삭제
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이벤트 ID입니다.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: '이미지 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Delete from DB and get image data
    const deletedImage = await deleteEventImage(parseInt(imageId));

    if (!deletedImage) {
      return NextResponse.json(
        { success: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Delete from R2
    try {
      await deleteFromR2(deletedImage.r2_key);
    } catch (e) {
      console.warn('Failed to delete image from R2:', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin gallery image delete error:', error);
    return NextResponse.json(
      { success: false, error: '이미지 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
