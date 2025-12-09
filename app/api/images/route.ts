import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAllImages, getImageByKeycode, upsertImage, deleteImage } from '@/lib/d1';
import { deleteFromR2 } from '@/lib/r2';

// GET - 이미지 데이터 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keycode = searchParams.get('keycode');

    if (keycode) {
      // 단일 이미지 조회
      const image = await getImageByKeycode(keycode);

      return NextResponse.json({
        success: true,
        data: image,
      });
    }

    // 전체 이미지 조회
    const images = await getAllImages();

    return NextResponse.json({
      success: true,
      data: images,
    });
  } catch (error) {
    console.error('Image fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}

// POST - 이미지 저장/업데이트 (upsert)
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { keycode, url, r2_key, alt_ko, alt_en, width, height, size, content_type } = body;

    if (!keycode || !url || !r2_key) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 기존 이미지 확인 (R2 파일 삭제용)
    const existing = await getImageByKeycode(keycode);

    // 기존 R2 파일 삭제 (새 이미지가 다른 경우)
    if (existing && existing.r2_key && existing.r2_key !== r2_key) {
      try {
        await deleteFromR2(existing.r2_key);
      } catch (e) {
        console.warn('Failed to delete old R2 file:', e);
      }
    }

    // DB 업데이트
    await upsertImage({
      keycode,
      url,
      r2_key,
      alt_ko,
      alt_en,
      width,
      height,
      size,
      content_type,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Image save error:', error);
    return NextResponse.json(
      { success: false, error: '저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - 이미지 삭제
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keycode = searchParams.get('keycode');

    if (!keycode) {
      return NextResponse.json(
        { success: false, error: '키코드가 필요합니다.' },
        { status: 400 }
      );
    }

    // 기존 이미지 조회
    const existing = await getImageByKeycode(keycode);

    if (existing && existing.r2_key) {
      // R2에서 파일 삭제
      try {
        await deleteFromR2(existing.r2_key);
      } catch (e) {
        console.warn('Failed to delete R2 file:', e);
      }
    }

    // DB에서 삭제
    const deleted = await deleteImage(keycode);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '해당 키코드를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Image delete error:', error);
    return NextResponse.json(
      { success: false, error: '삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
