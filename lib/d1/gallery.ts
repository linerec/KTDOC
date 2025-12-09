/**
 * Gallery D1 Database Queries
 * 공연 아카이브 시스템 데이터베이스 쿼리
 */

import { queryD1, executeD1 } from './client';
import type {
  EventCategory,
  Event,
  EventWithCategory,
  EventImage,
  EventVideo,
  EventDetail,
  EventFilters,
  CreateEventInput,
  UpdateEventInput,
  CreateImageInput,
  CreateVideoInput,
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
  } = filters;

  // Build WHERE clause
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (published) {
    conditions.push('e.is_published = 1');
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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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
     ORDER BY e.year DESC, e.event_date DESC, e.id DESC
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
    videos,
    category,
  };
}

export async function getEventBySlug(
  year: number,
  slug: string
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
  const [images, videos, category] = await Promise.all([
    getEventImages(event.id),
    getEventVideos(event.id),
    event.category_id ? getCategoryById(event.category_id) : Promise.resolve(null),
  ]);

  return {
    ...event,
    images,
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
      is_published, is_featured
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
