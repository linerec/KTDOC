/**
 * 보관함 사진(gallery_photos) 정리/삭제 핵심 로직 (서버 전용)
 *
 * 단건(PUT/DELETE) 라우트와 일괄(bulk) 라우트가 공유한다.
 * 공연 연결 시 event_images를 자동 생성/이동/삭제하고, 삭제 시 R2 객체까지 정리한다.
 */

import {
  clearGalleryPhotoEventImage,
  createEventImage,
  deleteEventImage,
  deleteGalleryPhoto,
  eventIdExists,
  getGalleryPhotoById,
  markGalleryPhotoEventImage,
  updateEventImageCaptions,
  updateGalleryPhoto,
} from '@/lib/d1';
import { deleteFromR2 } from '@/lib/r2';
import { getUserNamesByIds } from '@/lib/members';
import type { GalleryPhoto, UpdateGalleryPhotoInput } from '@/types/gallery';

/**
 * 사진 한 장의 메타데이터를 정리하고, event_id 변화에 맞춰 event_images를 동기화한다.
 * - 공연 연결 해제: 기존 event_image 삭제
 * - 공연 (재)연결: 필요 시 기존 event_image 제거 후 새 event_image 생성·연결
 * 정리 후 최신 사진 레코드를 반환한다.
 */
export async function organizePhoto(
  photo: GalleryPhoto,
  input: UpdateGalleryPhotoInput
): Promise<GalleryPhoto | null> {
  await updateGalleryPhoto(photo.id, input);

  // 공연 연결 해제 → 연결돼 있던 event_image 정리
  if (input.event_id === null && photo.event_image_id) {
    await deleteEventImage(photo.event_image_id);
    await clearGalleryPhotoEventImage(photo.id);
  }

  const targetEventId = input.event_id ?? null;
  const shouldAttachToEvent =
    targetEventId !== null &&
    (!photo.event_image_id || photo.event_id !== input.event_id);

  if (shouldAttachToEvent) {
    // 다른 공연으로 옮기는 경우 기존 event_image 먼저 제거
    if (photo.event_image_id && photo.event_id !== input.event_id) {
      await deleteEventImage(photo.event_image_id);
    }
    const eventImageId = await createEventImage(targetEventId, {
      image_url: photo.image_url,
      r2_key: photo.r2_key,
      caption_ko: input.caption_ko ?? photo.caption_ko ?? undefined,
      caption_en: input.caption_en ?? photo.caption_en ?? undefined,
      width: photo.width || undefined,
      height: photo.height || undefined,
      size: photo.size || undefined,
    });
    await markGalleryPhotoEventImage(photo.id, eventImageId);
  } else if (
    photo.event_image_id &&
    input.event_id !== null &&
    (input.caption_ko !== undefined || input.caption_en !== undefined)
  ) {
    // 연결이 그대로 유지되는 경우 — 캡션 수정을 공연 사본(event_images)에도 반영
    await updateEventImageCaptions(photo.event_image_id, {
      caption_ko: input.caption_ko,
      caption_en: input.caption_en,
    });
  }

  return getGalleryPhotoById(photo.id);
}

/** 연결할 공연이 실제로 존재하는지 검증 (없으면 false) */
export async function eventExists(eventId: number): Promise<boolean> {
  return eventIdExists(eventId);
}

/** 여러 장을 한 공연에 연결 (개별 사진은 organizePhoto 재사용) */
export async function attachPhotosToEvent(
  photos: GalleryPhoto[],
  eventId: number
): Promise<number> {
  let affected = 0;
  for (const photo of photos) {
    await organizePhoto(photo, { event_id: eventId });
    affected++;
  }
  return affected;
}

/** 여러 장의 공연 연결 해제 */
export async function detachPhotos(photos: GalleryPhoto[]): Promise<number> {
  let affected = 0;
  for (const photo of photos) {
    await organizePhoto(photo, { event_id: null });
    affected++;
  }
  return affected;
}

/** 사진 한 장을 보관함·연결된 event_image·R2에서 완전히 삭제한다. */
export async function deletePhotoFully(photo: GalleryPhoto): Promise<void> {
  await deleteGalleryPhoto(photo.id);

  if (photo.event_image_id) {
    await deleteEventImage(photo.event_image_id);
  }

  try {
    await deleteFromR2(photo.r2_key);
  } catch (error) {
    console.warn('Failed to delete gallery photo from R2:', error);
  }

  // 보관된 원본도 함께 지운다 — 표시본만 지우면 아무도 모르는 파일이 버킷에 쌓인다
  if (photo.original_key) {
    try {
      await deleteFromR2(photo.original_key);
    } catch (error) {
      console.warn('Failed to delete original photo from R2:', error);
    }
  }
}

/**
 * 사진 목록의 제출자(uploaded_by, D1)를 회원 이름(MySQL)으로 해석해 uploader_name을 채운다.
 * 저장소가 달라 조인 대신 id를 모아 한 번에 조회한다(운영진 보관함 표시용).
 */
export async function attachUploaderNames(photos: GalleryPhoto[]): Promise<GalleryPhoto[]> {
  const ids = photos.map((p) => p.uploaded_by).filter((v): v is string => !!v);
  if (ids.length === 0) return photos;
  const names = await getUserNamesByIds(ids);
  return photos.map((p) =>
    p.uploaded_by ? { ...p, uploader_name: names.get(p.uploaded_by) ?? null } : p
  );
}
