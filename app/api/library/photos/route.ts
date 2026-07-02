/**
 * 학생·학부모 사진 제출 API
 * POST /api/library/photos - 본인 사진 제출(항상 비공개·미분류로 보관함에 유입)
 * GET  /api/library/photos - 본인이 제출한 사진 목록(상태 포함)
 *
 * 보안: 로그인 + 정회원(active)만. 제출 사진은 서버에서 강제로
 *   is_published=0, event_id=null, uploaded_by=본인 으로 고정한다.
 *   (학생이 직접 공개하거나 이벤트에 넣을 수 없다 — 운영진 검토 후 반영)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isApproved } from '@/lib/isAdmin';
import {
  createGalleryPhoto,
  getGalleryPhotoById,
  getGalleryPhotos,
  eventIdExists,
  programIdExists,
} from '@/lib/d1';
import { uploadToR2 } from '@/lib/r2';

const MAX_FILES_PER_REQUEST = 20;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isApproved(session)) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '40', 10);

    const result = await getGalleryPhotos({
      uploadedBy: session.user.id,
      page,
      limit,
      sort: 'recent',
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Student photo list error:', error);
    return NextResponse.json(
      { success: false, error: '내 사진을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isApproved(session)) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    // 이벤트/수업 상세에서 제출하면 해당 항목에 연결한다(둘 중 하나). 비공개 보관은 동일.
    const eventIdRaw = formData.get('eventId');
    const programIdRaw = formData.get('programId');
    const eventId = eventIdRaw ? parseInt(String(eventIdRaw), 10) : NaN;
    const programId = programIdRaw ? parseInt(String(programIdRaw), 10) : NaN;
    const linkedEventId = Number.isFinite(eventId) ? eventId : undefined;
    const linkedProgramId =
      !linkedEventId && Number.isFinite(programId) ? programId : undefined;

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: '제출할 사진이 없습니다.' },
        { status: 400 }
      );
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { success: false, error: `한 번에 최대 ${MAX_FILES_PER_REQUEST}장까지 올릴 수 있습니다.` },
        { status: 400 }
      );
    }

    // 연결 대상이 실제로 존재하는지 업로드 전에 확인한다
    // (삭제된 이벤트/수업에 제출하면 FK 오류로 일부만 올라간 채 실패하는 것을 방지)
    if (linkedEventId && !(await eventIdExists(linkedEventId))) {
      return NextResponse.json(
        { success: false, error: '사진을 연결할 이벤트를 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도해주세요.' },
        { status: 404 }
      );
    }
    if (linkedProgramId && !(await programIdExists(linkedProgramId))) {
      return NextResponse.json(
        { success: false, error: '사진을 연결할 수업을 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도해주세요.' },
        { status: 404 }
      );
    }

    const uploaded = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const r2Result = await uploadToR2(buffer, filename, 'gallery/submissions');

      const photoId = await createGalleryPhoto({
        image_url: r2Result.url,
        r2_key: r2Result.key,
        size: file.size,
        is_published: false, // 학생 제출은 항상 비공개 — 운영진 검토 후 공개
        event_id: linkedEventId,
        program_id: linkedProgramId,
        uploaded_by: session.user.id,
      });
      const photo = await getGalleryPhotoById(photoId);
      if (photo) uploaded.push(photo);
    }

    if (uploaded.length === 0) {
      return NextResponse.json(
        { success: false, error: '이미지 파일만 올릴 수 있습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { photos: uploaded, count: uploaded.length },
    });
  } catch (error) {
    console.error('Student photo submit error:', error);
    return NextResponse.json(
      { success: false, error: '사진 제출에 실패했습니다.' },
      { status: 500 }
    );
  }
}
