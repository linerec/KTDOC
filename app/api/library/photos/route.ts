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
import { readUploads } from '@/lib/r2/readUploads';
import { uploadTargetByKey } from '@/lib/r2/uploadTargets';

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
    // 파일은 브라우저에서 R2로 직접 올라온다 — 여기 오는 것은 티켓뿐이다.
    const target = uploadTargetByKey('library-photos', 'gallery/submissions')!;
    const intake = await readUploads(request, {
      target,
      userId: session.user.id,
      maxFiles: MAX_FILES_PER_REQUEST,
    });

    // 이벤트/수업 상세에서 제출하면 해당 항목에 연결한다(둘 중 하나). 비공개 보관은 동일.
    const eventIdRaw = intake.field('eventId');
    const programIdRaw = intake.field('programId');
    const eventId = eventIdRaw ? parseInt(String(eventIdRaw), 10) : NaN;
    const programId = programIdRaw ? parseInt(String(programIdRaw), 10) : NaN;
    const linkedEventId = Number.isFinite(eventId) ? eventId : undefined;
    const linkedProgramId =
      !linkedEventId && Number.isFinite(programId) ? programId : undefined;

    if (intake.uploads.length === 0) {
      return NextResponse.json(
        { success: false, error: intake.error ?? '제출할 사진이 없습니다.' },
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

    for (const file of intake.uploads) {
      const photoId = await createGalleryPhoto({
        image_url: file.url,
        r2_key: file.key,
        original_key: file.originalKey,
        width: file.width ?? undefined,
        height: file.height ?? undefined,
        size: file.size,
        is_published: false, // 학생 제출은 항상 비공개 — 운영진 검토 후 공개
        event_id: linkedEventId,
        program_id: linkedProgramId,
        uploaded_by: session.user.id,
      });
      const photo = await getGalleryPhotoById(photoId);
      if (photo) uploaded.push(photo);
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
