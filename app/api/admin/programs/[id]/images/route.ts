/**
 * Admin Program Images API
 * POST   /api/admin/programs/[id]/images - 묶음 사진 업로드 (다중)
 * DELETE /api/admin/programs/[id]/images?imageId=xxx - 사진 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getProgramById, createProgramImage, deleteProgramImage } from '@/lib/d1';
import { deleteFromR2 } from '@/lib/r2';
import { readUploads } from '@/lib/r2/readUploads';
import { uploadTargetByKey } from '@/lib/r2/uploadTargets';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const programId = parseInt(id);
    if (isNaN(programId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 프로그램 ID입니다.' },
        { status: 400 }
      );
    }

    const program = await getProgramById(programId);
    if (!program) {
      return NextResponse.json(
        { success: false, error: '프로그램을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 파일은 브라우저에서 R2로 직접 올라온다 — 여기 오는 것은 티켓뿐이다.
    const target = uploadTargetByKey('program-images', `programs/${programId}`)!;
    const intake = await readUploads(request, {
      target,
      userId: session?.user?.id ?? '',
    });

    if (intake.uploads.length === 0) {
      return NextResponse.json(
        { success: false, error: intake.error ?? '업로드할 파일이 없습니다.' },
        { status: 400 }
      );
    }

    const uploadedImages = [];
    for (const file of intake.uploads) {
      const imageId = await createProgramImage(programId, {
        image_url: file.url,
        r2_key: file.key,
        size: file.size,
      });

      uploadedImages.push({
        id: imageId,
        program_id: programId,
        image_url: file.url,
        r2_key: file.key,
        sort_order: 0,
        caption_ko: null,
        caption_en: null,
        width: file.width,
        height: file.height,
        size: file.size,
        created_at: '',
      });
    }

    return NextResponse.json({
      success: true,
      data: { images: uploadedImages, count: uploadedImages.length },
    });
  } catch (error) {
    console.error('Admin program image upload error:', error);
    return NextResponse.json(
      { success: false, error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const programId = parseInt(id);
    if (isNaN(programId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 프로그램 ID입니다.' },
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

    const deletedImage = await deleteProgramImage(parseInt(imageId));
    if (!deletedImage) {
      return NextResponse.json(
        { success: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    try {
      await deleteFromR2(deletedImage.r2_key);
    } catch (e) {
      console.warn('Failed to delete image from R2:', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin program image delete error:', error);
    return NextResponse.json(
      { success: false, error: '이미지 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
