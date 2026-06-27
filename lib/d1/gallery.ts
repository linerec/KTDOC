/**
 * Gallery D1 Database Queries
 * 공연 아카이브 시스템 데이터베이스 쿼리
 */

import { queryD1, executeD1 } from './client';
import type {
  EventCategory,
  EventWithCategory,
  EventImage,
  EventVideo,
  GalleryPhoto,
  EventDetail,
  EventFilters,
  GalleryPhotoFilters,
  CreateEventInput,
  UpdateEventInput,
  CreateImageInput,
  CreateVideoInput,
  CreateGalleryPhotoInput,
  UpdateGalleryPhotoInput,
  CreateCategoryInput,
} from '@/types/gallery';
import { generateSlug, extractYouTubeId } from '@/types/gallery';

// ============================================
// Categories
// ============================================

export async function getCategories(): Promise<EventCategory[]> {
  return queryD1<EventCategory>(
    'SELECT * FROM event_categories ORDER BY sort_order ASC'
  );
}

export async function getCategoryBySlug(slug: string): Promise<EventCategory | null> {
  const results = await queryD1<EventCategory>(
    'SELECT * FROM event_categories WHERE slug = ?',
    [slug]
  );
  return results[0] || null;
}

export async function getCategoryById(id: number): Promise<EventCategory | null> {
  const results = await queryD1<EventCategory>(
    'SELECT * FROM event_categories WHERE id = ?',
    [id]
  );
  return results[0] || null;
}

export async function createCategory(input: CreateCategoryInput): Promise<number> {
  const { lastRowId } = await executeD1(
    `INSERT INTO event_categories (slug, name_ko, name_en, sort_order)
     VALUES (?, ?, ?, ?)`,
    [input.slug, input.name_ko, input.name_en, input.sort_order || 0]
  );
  return lastRowId;
}

export async function updateCategory(
  id: number,
  input: Partial<CreateCategoryInput>
): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.slug !== undefined) {
    updates.push('slug = ?');
    params.push(input.slug);
  }
  if (input.name_ko !== undefined) {
    updates.push('name_ko = ?');
    params.push(input.name_ko);
  }
  if (input.name_en !== undefined) {
    updates.push('name_en = ?');
    params.push(input.name_en);
  }
  if (input.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sort_order);
  }

  if (updates.length === 0) return;

  params.push(id);
  await executeD1(
    `UPDATE event_categories SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
}

export async function deleteCategory(id: number): Promise<void> {
  await executeD1('DELETE FROM event_categories WHERE id = ?', [id]);
}

// ============================================
// Events
// ============================================

export async function getEvents(filters: EventFilters = {}): Promise<{
  events: EventWithCategory[];
  total: number;
  years: number[];
}> {
  const {
    year,
    category,
    search,
    page = 1,
    limit = 20,
    featured,
    published = true,
    showcase,
  } = filters;

  // Build WHERE clause
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (published === true) {
    conditions.push('e.is_published = 1');
  } else if (published === false) {
    conditions.push('e.is_published = 0');
  }

  if (year) {
    conditions.push('e.year = ?');
    params.push(year);
  }

  if (category) {
    conditions.push('c.slug = ?');
    params.push(category);
  }

  if (search) {
    conditions.push('(e.title_ko LIKE ? OR e.title_en LIKE ? OR e.description_ko LIKE ? OR e.description_en LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (featured !== undefined) {
    conditions.push('e.is_featured = ?');
    params.push(featured ? 1 : 0);
  }

  if (showcase) {
    conditions.push('e.is_signature = 1');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = showcase
    ? 'ORDER BY e.signature_order ASC, e.event_date DESC, e.id DESC'
    : 'ORDER BY e.year DESC, e.event_date DESC, e.id DESC';

  // Get total count
  const countResult = await queryD1<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM events e
     LEFT JOIN event_categories c ON e.category_id = c.id
     ${whereClause}`,
    params
  );
  const total = countResult[0]?.count || 0;

  // Get events with pagination (includes first image as thumbnail fallback)
  const offset = (page - 1) * limit;
  const events = await queryD1<EventWithCategory>(
    `SELECT e.*,
            c.name_ko as category_name_ko,
            c.name_en as category_name_en,
            c.slug as category_slug,
            (SELECT image_url FROM event_images WHERE event_id = e.id ORDER BY sort_order ASC LIMIT 1) as first_image_url
     FROM events e
     LEFT JOIN event_categories c ON e.category_id = c.id
     ${whereClause}
     ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Get distinct years
  const yearsResult = await queryD1<{ year: number }>(
    'SELECT DISTINCT year FROM events WHERE is_published = 1 ORDER BY year DESC'
  );
  const years = yearsResult.map((r) => r.year);

  return { events, total, years };
}

export async function getEventById(id: number): Promise<EventDetail | null> {
  const events = await queryD1<EventWithCategory>(
    `SELECT e.*,
            c.name_ko as category_name_ko,
            c.name_en as category_name_en,
            c.slug as category_slug
     FROM events e
     LEFT JOIN event_categories c ON e.category_id = c.id
     WHERE e.id = ?`,
    [id]
  );

  if (events.length === 0) return null;

  const event = events[0];
  const [images, videos, category] = await Promise.all([
    getEventImages(id),
    getEventVideos(id),
    event.category_id ? getCategoryById(event.category_id) : Promise.resolve(null),
  ]);

  return {
    ...event,
    images,
    image_total: images.length,
    videos,
    category,
  };
}

export async function getEventBySlug(
  year: number,
  slug: string,
  options: { imagesLimit?: number } = {}
): Promise<EventDetail | null> {
  const events = await queryD1<EventWithCategory>(
    `SELECT e.*,
            c.name_ko as category_name_ko,
            c.name_en as category_name_en,
            c.slug as category_slug
     FROM events e
     LEFT JOIN event_categories c ON e.category_id = c.id
     WHERE e.year = ? AND e.slug = ?`,
    [year, slug]
  );

  if (events.length === 0) return null;

  const event = events[0];
  // imagesLimit가 주어지면 첫 페이지만 로드(수천 장 대비). 없으면 기존처럼 전체 로드.
  const imagesPromise =
    options.imagesLimit && options.imagesLimit > 0
      ? getEventImagesPaged(event.id, 1, options.imagesLimit)
      : getEventImages(event.id).then((images) => ({ images, total: images.length }));

  const [imagesResult, videos, category] = await Promise.all([
    imagesPromise,
    getEventVideos(event.id),
    event.category_id ? getCategoryById(event.category_id) : Promise.resolve(null),
  ]);

  return {
    ...event,
    images: imagesResult.images,
    image_total: imagesResult.total,
    videos,
    category,
  };
}

export async function createEvent(input: CreateEventInput): Promise<number> {
  const year = new Date(input.event_date).getFullYear();
  const slug = input.slug || generateSlug(input.title_ko);

  const { lastRowId } = await executeD1(
    `INSERT INTO events (
      slug, year, event_date, title_ko, title_en,
      description_ko, description_en, category_id,
      is_published, is_featured, is_signature, signature_order,
      location, location_url, call_time, start_time, end_time, prep_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      year,
      input.event_date,
      input.title_ko,
      input.title_en || null,
      input.description_ko || null,
      input.description_en || null,
      input.category_id || null,
      input.is_published ? 1 : 0,
      input.is_featured ? 1 : 0,
      input.is_signature ? 1 : 0,
      input.signature_order ?? 0,
      input.location || null,
      input.location_url || null,
      input.call_time || null,
      input.start_time || null,
      input.end_time || null,
      input.prep_notes || null,
    ]
  );

  return lastRowId;
}

export async function updateEvent(
  id: number,
  input: UpdateEventInput
): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.title_ko !== undefined) {
    updates.push('title_ko = ?');
    params.push(input.title_ko);
  }
  if (input.title_en !== undefined) {
    updates.push('title_en = ?');
    params.push(input.title_en);
  }
  if (input.event_date !== undefined) {
    updates.push('event_date = ?');
    params.push(input.event_date);
    updates.push('year = ?');
    params.push(new Date(input.event_date).getFullYear());
  }
  if (input.description_ko !== undefined) {
    updates.push('description_ko = ?');
    params.push(input.description_ko);
  }
  if (input.description_en !== undefined) {
    updates.push('description_en = ?');
    params.push(input.description_en);
  }
  if (input.category_id !== undefined) {
    updates.push('category_id = ?');
    params.push(input.category_id);
  }
  if (input.slug !== undefined) {
    updates.push('slug = ?');
    params.push(input.slug);
  }
  if (input.poster_url !== undefined) {
    updates.push('poster_url = ?');
    params.push(input.poster_url);
  }
  if (input.poster_r2_key !== undefined) {
    updates.push('poster_r2_key = ?');
    params.push(input.poster_r2_key);
  }
  if (input.thumbnail_url !== undefined) {
    updates.push('thumbnail_url = ?');
    params.push(input.thumbnail_url);
  }
  if (input.thumbnail_r2_key !== undefined) {
    updates.push('thumbnail_r2_key = ?');
    params.push(input.thumbnail_r2_key);
  }
  if (input.is_published !== undefined) {
    updates.push('is_published = ?');
    params.push(input.is_published ? 1 : 0);
  }
  if (input.is_featured !== undefined) {
    updates.push('is_featured = ?');
    params.push(input.is_featured ? 1 : 0);
  }
  if (input.is_signature !== undefined) {
    updates.push('is_signature = ?');
    params.push(input.is_signature ? 1 : 0);
  }
  if (input.signature_order !== undefined) {
    updates.push('signature_order = ?');
    params.push(input.signature_order);
  }
  // 실행 정보(빈 문자열은 null로 저장)
  if (input.location !== undefined) {
    updates.push('location = ?');
    params.push(input.location || null);
  }
  if (input.location_url !== undefined) {
    updates.push('location_url = ?');
    params.push(input.location_url || null);
  }
  if (input.call_time !== undefined) {
    updates.push('call_time = ?');
    params.push(input.call_time || null);
  }
  if (input.start_time !== undefined) {
    updates.push('start_time = ?');
    params.push(input.start_time || null);
  }
  if (input.end_time !== undefined) {
    updates.push('end_time = ?');
    params.push(input.end_time || null);
  }
  if (input.prep_notes !== undefined) {
    updates.push('prep_notes = ?');
    params.push(input.prep_notes || null);
  }

  if (updates.length === 0) return;

  updates.push("updated_at = datetime('now')");
  params.push(id);

  await executeD1(
    `UPDATE events SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
}

export async function deleteEvent(id: number): Promise<void> {
  // CASCADE will handle event_images and event_videos
  await executeD1('DELETE FROM events WHERE id = ?', [id]);
}

export async function incrementViewCount(id: number): Promise<void> {
  await executeD1(
    'UPDATE events SET view_count = view_count + 1 WHERE id = ?',
    [id]
  );
}

// ============================================
// Event Images
// ============================================

export async function getEventImages(eventId: number): Promise<EventImage[]> {
  return queryD1<EventImage>(
    'SELECT * FROM event_images WHERE event_id = ? ORDER BY sort_order ASC',
    [eventId]
  );
}

/**
 * 여러 이벤트의 미리보기 이미지(이벤트당 상위 perEvent장)를 단일 쿼리로.
 * 학생 아카이브처럼 여러 이벤트를 한 화면에 모을 때 N+1 라운드트립을 피한다.
 * 반환: event_id → 이미지 배열(정렬 순).
 */
export async function getPreviewImagesForEvents(
  eventIds: number[],
  perEvent = 3
): Promise<Map<number, EventImage[]>> {
  if (eventIds.length === 0) return new Map();
  const placeholders = eventIds.map(() => '?').join(', ');
  const rows = await queryD1<EventImage>(
    `SELECT id, event_id, image_url, r2_key, sort_order,
            caption_ko, caption_en, width, height, size, created_at
     FROM (
       SELECT *, ROW_NUMBER() OVER (
         PARTITION BY event_id ORDER BY sort_order ASC, id ASC
       ) AS rn
       FROM event_images
       WHERE event_id IN (${placeholders})
     )
     WHERE rn <= ?`,
    [...eventIds, perEvent]
  );
  const map = new Map<number, EventImage[]>();
  for (const r of rows) {
    const list = map.get(r.event_id) ?? [];
    list.push(r);
    map.set(r.event_id, list);
  }
  return map;
}

/**
 * 이벤트 이미지 페이지네이션 조회
 * 한 이벤트에 사진이 수백~수천 장이어도 페이지 단위로만 로드한다.
 * publishedOnly=true 이면 비공개 이벤트의 이미지는 노출하지 않는다(공개 API용).
 */
export async function getEventImagesPaged(
  eventId: number,
  page = 1,
  limit = 24,
  publishedOnly = false
): Promise<{ images: EventImage[]; total: number }> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safeLimit;

  if (publishedOnly) {
    const countResult = await queryD1<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM event_images i
       JOIN events e ON i.event_id = e.id
       WHERE i.event_id = ? AND e.is_published = 1`,
      [eventId]
    );
    const images = await queryD1<EventImage>(
      `SELECT i.*
       FROM event_images i
       JOIN events e ON i.event_id = e.id
       WHERE i.event_id = ? AND e.is_published = 1
       ORDER BY i.sort_order ASC, i.id ASC
       LIMIT ? OFFSET ?`,
      [eventId, safeLimit, offset]
    );
    return { images, total: countResult[0]?.count || 0 };
  }

  const countResult = await queryD1<{ count: number }>(
    'SELECT COUNT(*) as count FROM event_images WHERE event_id = ?',
    [eventId]
  );
  const images = await queryD1<EventImage>(
    `SELECT * FROM event_images
     WHERE event_id = ?
     ORDER BY sort_order ASC, id ASC
     LIMIT ? OFFSET ?`,
    [eventId, safeLimit, offset]
  );
  return { images, total: countResult[0]?.count || 0 };
}

export async function createEventImage(
  eventId: number,
  input: CreateImageInput
): Promise<number> {
  // Get max sort_order
  const maxOrder = await queryD1<{ max_order: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM event_images WHERE event_id = ?',
    [eventId]
  );
  const sortOrder = (maxOrder[0]?.max_order ?? -1) + 1;

  const { lastRowId } = await executeD1(
    `INSERT INTO event_images (
      event_id, image_url, r2_key, sort_order,
      caption_ko, caption_en, width, height, size
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      input.image_url,
      input.r2_key,
      sortOrder,
      input.caption_ko || null,
      input.caption_en || null,
      input.width || null,
      input.height || null,
      input.size || null,
    ]
  );

  return lastRowId;
}

export async function updateImageOrder(
  eventId: number,
  imageIds: number[]
): Promise<void> {
  for (let i = 0; i < imageIds.length; i++) {
    await executeD1(
      'UPDATE event_images SET sort_order = ? WHERE id = ? AND event_id = ?',
      [i, imageIds[i], eventId]
    );
  }
}

export async function deleteEventImage(id: number): Promise<EventImage | null> {
  // Get image data before deleting (for R2 cleanup)
  const images = await queryD1<EventImage>(
    'SELECT * FROM event_images WHERE id = ?',
    [id]
  );

  if (images.length === 0) return null;

  await executeD1('DELETE FROM event_images WHERE id = ?', [id]);
  return images[0];
}

export async function deleteAllEventImages(eventId: number): Promise<EventImage[]> {
  const images = await getEventImages(eventId);
  await executeD1('DELETE FROM event_images WHERE event_id = ?', [eventId]);
  return images;
}

// ============================================
// Event Videos
// ============================================

export async function getEventVideos(eventId: number): Promise<EventVideo[]> {
  return queryD1<EventVideo>(
    'SELECT * FROM event_videos WHERE event_id = ? ORDER BY sort_order ASC',
    [eventId]
  );
}

export async function createEventVideo(
  eventId: number,
  input: CreateVideoInput
): Promise<number> {
  const youtubeId = extractYouTubeId(input.youtube_url);
  if (!youtubeId) {
    throw new Error('Invalid YouTube URL');
  }

  // Get max sort_order
  const maxOrder = await queryD1<{ max_order: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM event_videos WHERE event_id = ?',
    [eventId]
  );
  const sortOrder = (maxOrder[0]?.max_order ?? -1) + 1;

  const { lastRowId } = await executeD1(
    `INSERT INTO event_videos (event_id, youtube_url, youtube_id, title, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [eventId, input.youtube_url, youtubeId, input.title || null, sortOrder]
  );

  return lastRowId;
}

export async function updateVideoOrder(
  eventId: number,
  videoIds: number[]
): Promise<void> {
  for (let i = 0; i < videoIds.length; i++) {
    await executeD1(
      'UPDATE event_videos SET sort_order = ? WHERE id = ? AND event_id = ?',
      [i, videoIds[i], eventId]
    );
  }
}

export async function deleteEventVideo(id: number): Promise<void> {
  await executeD1('DELETE FROM event_videos WHERE id = ?', [id]);
}

// ============================================
// Loose Gallery Photos
// ============================================

export async function getGalleryPhotos(filters: GalleryPhotoFilters = {}): Promise<{
  photos: GalleryPhoto[];
  total: number;
}> {
  const {
    search,
    page = 1,
    limit = 60,
    published,
    organized = 'all',
    eventId,
    sort = 'recent',
    uploadedBy,
    submitted = 'all',
  } = filters;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (published !== undefined) {
    conditions.push('gp.is_published = ?');
    params.push(published ? 1 : 0);
  }

  if (organized === 'assigned') {
    conditions.push('gp.event_id IS NOT NULL');
  } else if (organized === 'unassigned') {
    conditions.push('gp.event_id IS NULL');
  }

  if (eventId) {
    conditions.push('gp.event_id = ?');
    params.push(eventId);
  }

  if (uploadedBy) {
    conditions.push('gp.uploaded_by = ?');
    params.push(uploadedBy);
  }

  if (submitted === 'student') {
    conditions.push('gp.uploaded_by IS NOT NULL');
  } else if (submitted === 'staff') {
    conditions.push('gp.uploaded_by IS NULL');
  }

  if (search) {
    conditions.push(`(
      gp.caption_ko LIKE ? OR gp.caption_en LIKE ? OR
      e.title_ko LIKE ? OR e.title_en LIKE ?
    )`);
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  // 정렬: 최신/오래된순은 등록일, taken은 촬영일(없는 값은 뒤로 — SQLite는 NULLS LAST 미지원)
  const orderBy =
    sort === 'oldest'
      ? 'ORDER BY gp.created_at ASC, gp.id ASC'
      : sort === 'taken'
        ? 'ORDER BY gp.taken_date IS NULL, gp.taken_date DESC, gp.created_at DESC, gp.id DESC'
        : 'ORDER BY gp.created_at DESC, gp.id DESC';

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await queryD1<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM gallery_photos gp
     LEFT JOIN events e ON gp.event_id = e.id
     ${whereClause}`,
    params
  );

  const offset = (page - 1) * limit;
  const photos = await queryD1<GalleryPhoto>(
    `SELECT gp.*,
            e.title_ko as event_title_ko,
            e.title_en as event_title_en,
            e.year as event_year,
            e.slug as event_slug
     FROM gallery_photos gp
     LEFT JOIN events e ON gp.event_id = e.id
     ${whereClause}
     ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    photos,
    total: countResult[0]?.count || 0,
  };
}

/**
 * 보관함 사진 플래그(공개/강조)를 여러 장 한 번에 설정한다.
 * 공개·강조는 event_images 동기화가 필요 없어 단일 UPDATE로 처리한다.
 */
export async function bulkSetGalleryPhotoFlag(
  ids: number[],
  field: 'is_published' | 'is_featured',
  value: boolean
): Promise<number> {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => '?').join(', ');
  await executeD1(
    `UPDATE gallery_photos
     SET ${field} = ?, updated_at = datetime('now')
     WHERE id IN (${placeholders})`,
    [value ? 1 : 0, ...ids]
  );
  return ids.length;
}

export async function getGalleryPhotoById(id: number): Promise<GalleryPhoto | null> {
  const photos = await queryD1<GalleryPhoto>(
    `SELECT gp.*,
            e.title_ko as event_title_ko,
            e.title_en as event_title_en,
            e.year as event_year,
            e.slug as event_slug
     FROM gallery_photos gp
     LEFT JOIN events e ON gp.event_id = e.id
     WHERE gp.id = ?`,
    [id]
  );

  return photos[0] || null;
}

export async function createGalleryPhoto(input: CreateGalleryPhotoInput): Promise<number> {
  const maxOrder = await queryD1<{ max_order: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM gallery_photos'
  );
  const sortOrder = (maxOrder[0]?.max_order ?? -1) + 1;

  const { lastRowId } = await executeD1(
    `INSERT INTO gallery_photos (
      image_url, r2_key, caption_ko, caption_en, taken_date,
      event_id, is_published, is_featured, sort_order,
      width, height, size, uploaded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.image_url,
      input.r2_key,
      input.caption_ko || null,
      input.caption_en || null,
      input.taken_date || null,
      input.event_id || null,
      input.is_published ? 1 : 0,
      input.is_featured ? 1 : 0,
      sortOrder,
      input.width || null,
      input.height || null,
      input.size || null,
      input.uploaded_by || null,
    ]
  );

  return lastRowId;
}

export async function updateGalleryPhoto(
  id: number,
  input: UpdateGalleryPhotoInput
): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.caption_ko !== undefined) {
    updates.push('caption_ko = ?');
    params.push(input.caption_ko || null);
  }
  if (input.caption_en !== undefined) {
    updates.push('caption_en = ?');
    params.push(input.caption_en || null);
  }
  if (input.taken_date !== undefined) {
    updates.push('taken_date = ?');
    params.push(input.taken_date || null);
  }
  if (input.event_id !== undefined) {
    updates.push('event_id = ?');
    params.push(input.event_id || null);
  }
  if (input.is_published !== undefined) {
    updates.push('is_published = ?');
    params.push(input.is_published ? 1 : 0);
  }
  if (input.is_featured !== undefined) {
    updates.push('is_featured = ?');
    params.push(input.is_featured ? 1 : 0);
  }
  if (input.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sort_order);
  }

  if (updates.length === 0) return;

  updates.push("updated_at = datetime('now')");
  params.push(id);

  await executeD1(
    `UPDATE gallery_photos SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
}

export async function markGalleryPhotoEventImage(
  id: number,
  eventImageId: number
): Promise<void> {
  await executeD1(
    "UPDATE gallery_photos SET event_image_id = ?, updated_at = datetime('now') WHERE id = ?",
    [eventImageId, id]
  );
}

export async function clearGalleryPhotoEventImage(id: number): Promise<void> {
  await executeD1(
    "UPDATE gallery_photos SET event_image_id = NULL, updated_at = datetime('now') WHERE id = ?",
    [id]
  );
}

export async function deleteGalleryPhoto(id: number): Promise<GalleryPhoto | null> {
  const photo = await getGalleryPhotoById(id);
  if (!photo) return null;

  await executeD1('DELETE FROM gallery_photos WHERE id = ?', [id]);
  return photo;
}

// ============================================
// Utility Functions
// ============================================

export async function getYears(): Promise<number[]> {
  const result = await queryD1<{ year: number }>(
    'SELECT DISTINCT year FROM events WHERE is_published = 1 ORDER BY year DESC'
  );
  return result.map((r) => r.year);
}

export async function getAdjacentEvents(
  eventId: number,
  year: number
): Promise<{ prev: EventWithCategory | null; next: EventWithCategory | null }> {
  const [prevResults, nextResults] = await Promise.all([
    queryD1<EventWithCategory>(
      `SELECT e.*, c.name_ko as category_name_ko, c.name_en as category_name_en, c.slug as category_slug
       FROM events e
       LEFT JOIN event_categories c ON e.category_id = c.id
       WHERE e.is_published = 1 AND (e.year < ? OR (e.year = ? AND e.id < ?))
       ORDER BY e.year DESC, e.event_date DESC, e.id DESC
       LIMIT 1`,
      [year, year, eventId]
    ),
    queryD1<EventWithCategory>(
      `SELECT e.*, c.name_ko as category_name_ko, c.name_en as category_name_en, c.slug as category_slug
       FROM events e
       LEFT JOIN event_categories c ON e.category_id = c.id
       WHERE e.is_published = 1 AND (e.year > ? OR (e.year = ? AND e.id > ?))
       ORDER BY e.year ASC, e.event_date ASC, e.id ASC
       LIMIT 1`,
      [year, year, eventId]
    ),
  ]);

  return {
    prev: prevResults[0] || null,
    next: nextResults[0] || null,
  };
}
