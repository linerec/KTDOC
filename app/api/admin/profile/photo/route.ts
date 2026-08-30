/**
 * Profile Photo API
 * POST   /api/admin/profile/photo - 로그인한 사용자가 자신의 프로필 사진 업로드(교체 포함)
 * DELETE /api/admin/profile/photo - 자신의 프로필 사진 제거
 *
 * 항상 "본인" 사진만 다룬다(대상 userId를 받지 않음). 파일은 R2 `profiles/` 폴더에
 * 저장하고 users.profile_photo_url에 공개 URL을 기록한다. 교체·삭제 시 이전 R2
 * 객체는 베스트에포트로 정리한다(실패해도 DB 상태가 우선).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteFromR2, R2_PUBLIC_URL } from '@/lib/r2';
import { getProfilePhotoUrl, setProfilePhotoUrl } from '@/lib/members';
import { readUploads } from '@/lib/r2/readUploads';
import { uploadTargetByKey } from '@/lib/r2/uploadTargets';

// Vercel 함수 바디 한도(4.5MB) 내 실효 한도 — lib/uploadLimits.ts 참조

/** 공개 URL → R2 키. 우리 버킷 URL이 아니면 null(외부 URL은 건드리지 않음). */
function r2KeyFromUrl(url: string): string | null {
  const prefix = `${R2_PUBLIC_URL}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

async function deleteOldPhoto(userId: string): Promise<void> {
  const oldUrl = await getProfilePhotoUrl(userId);
  if (!oldUrl) return;
  const key = r2KeyFromUrl(oldUrl);
  if (!key) return;
  await deleteFromR2(key).catch((err) => {
    console.error('이전 프로필 사진 R2 정리 실패(무시):', err);
  });
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 파일은 브라우저에서 R2로 직접 올라온다 — 여기 오는 것은 티켓뿐이다.
    const target = uploadTargetByKey('profile', 'profiles')!;
    const intake = await readUploads(request, {
      target,
      userId: session.user.id,
      maxFiles: 1,
    });
    const result = intake.uploads[0];

    if (!result) {
      return NextResponse.json(
        { success: false, error: intake.error ?? '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 새 사진이 확실히 자리를 잡은 뒤에 옛 사진을 지운다 —
    // 먼저 지웠다가 업로드가 실패하면 프로필이 빈 채로 남는다.
    await deleteOldPhoto(session.user.id);
    await setProfilePhotoUrl(session.user.id, result.url);

    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    console.error('프로필 사진 업로드 오류:', error);
    return NextResponse.json(
      { success: false, error: '업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    await deleteOldPhoto(session.user.id);
    await setProfilePhotoUrl(session.user.id, null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('프로필 사진 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
