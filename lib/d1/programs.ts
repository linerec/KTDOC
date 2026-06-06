/**
 * Programs D1 Database Queries
 * 수업·프로그램·캠프 데이터베이스 쿼리 (lib/d1/gallery.ts 규약을 따름)
 */

import { queryD1, executeD1 } from './client';
import type {
  ProgramWithMeta,
  ProgramDetail,
  ProgramImage,
  ProgramFilters,
  CreateProgramInput,
  UpdateProgramInput,
  CreateProgramImageInput,
} from '@/types/programs';
import { generateSlug } from '@/types/programs';

// ============================================
// Programs
// ============================================

export async function getPrograms(filters: ProgramFilters = {}): Promise<{
  programs: ProgramWithMeta[];
  total: number;
}> {
  const { type, search, page = 1, limit = 100, featured, published = true } = filters;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (published === true) {
    conditions.push('p.is_published = 1');
  } else if (published === false) {
    conditions.push('p.is_published = 0');
  }

  if (type) {
    conditions.push('p.program_type = ?');
    params.push(type);
  }

  if (featured !== undefined) {
    conditions.push('p.is_featured = ?');
    params.push(featured ? 1 : 0);
  }

  if (search) {
    conditions.push(
      '(p.title_ko LIKE ? OR p.title_en LIKE ? OR p.summary_ko LIKE ? OR p.description_ko LIKE ?)'
    );
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryD1<{ count: number }>(
    `SELECT COUNT(*) as count FROM programs p ${whereClause}`,
    params
  );
  const total = countResult[0]?.count || 0;

  const offset = (page - 1) * limit;
  const programs = await queryD1<ProgramWithMeta>(
    `SELECT p.*,
            (SELECT image_url FROM program_images WHERE program_id = p.id ORDER BY sort_order ASC LIMIT 1) as first_image_url
     FROM programs p
     ${whereClause}
     ORDER BY p.sort_order ASC, p.is_featured DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { programs, total };
}

export async function getProgramById(id: number): Promise<ProgramDetail | null> {
  const programs = await queryD1<ProgramWithMeta>(
    `SELECT p.*,
            (SELECT image_url FROM program_images WHERE program_id = p.id ORDER BY sort_order ASC LIMIT 1) as first_image_url
     FROM programs p WHERE p.id = ?`,
    [id]
  );

  if (programs.length === 0) return null;

  const images = await getProgramImages(id);
  return { ...programs[0], images };
}

export async function getProgramBySlug(slug: string): Promise<ProgramDetail | null> {
  const programs = await queryD1<ProgramWithMeta>(
    `SELECT p.*,
            (SELECT image_url FROM program_images WHERE program_id = p.id ORDER BY sort_order ASC LIMIT 1) as first_image_url
     FROM programs p WHERE p.slug = ?`,
    [slug]
  );

  if (programs.length === 0) return null;

  const images = await getProgramImages(programs[0].id);
  return { ...programs[0], images };
}

export async function createProgram(input: CreateProgramInput): Promise<number> {
  const slug = input.slug || generateSlug(input.title_ko);

  const { lastRowId } = await executeD1(
    `INSERT INTO programs (
      slug, program_type, title_ko, title_en, summary_ko, summary_en,
      description_ko, description_en, age_range, schedule_ko, schedule_en,
      start_date, end_date, price_ko, price_en, location_ko, location_en,
      is_featured, is_published, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      input.program_type,
      input.title_ko,
      input.title_en || null,
      input.summary_ko || null,
      input.summary_en || null,
      input.description_ko || null,
      input.description_en || null,
      input.age_range || null,
      input.schedule_ko || null,
      input.schedule_en || null,
      input.start_date || null,
      input.end_date || null,
      input.price_ko || null,
      input.price_en || null,
      input.location_ko || null,
      input.location_en || null,
      input.is_featured ? 1 : 0,
      input.is_published ? 1 : 0,
      input.sort_order ?? 0,
    ]
  );

  return lastRowId;
}

export async function updateProgram(id: number, input: UpdateProgramInput): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];

  const setText = (key: keyof UpdateProgramInput, column?: string) => {
    if (input[key] !== undefined) {
      updates.push(`${column || key} = ?`);
      params.push((input[key] as string | undefined) || null);
    }
  };

  if (input.program_type !== undefined) {
    updates.push('program_type = ?');
    params.push(input.program_type);
  }
  if (input.title_ko !== undefined) {
    updates.push('title_ko = ?');
    params.push(input.title_ko);
  }
  setText('title_en');
  setText('summary_ko');
  setText('summary_en');
  setText('description_ko');
  setText('description_en');
  setText('age_range');
  setText('schedule_ko');
  setText('schedule_en');
  setText('start_date');
  setText('end_date');
  setText('price_ko');
  setText('price_en');
  setText('location_ko');
  setText('location_en');
  setText('poster_url');
  setText('poster_r2_key');
  setText('thumbnail_url');
  setText('thumbnail_r2_key');
  if (input.slug !== undefined) {
    updates.push('slug = ?');
    params.push(input.slug);
  }
  if (input.is_featured !== undefined) {
    updates.push('is_featured = ?');
    params.push(input.is_featured ? 1 : 0);
  }
  if (input.is_published !== undefined) {
    updates.push('is_published = ?');
    params.push(input.is_published ? 1 : 0);
  }
  if (input.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sort_order);
  }

  if (updates.length === 0) return;

  updates.push("updated_at = datetime('now')");
  params.push(id);

  await executeD1(`UPDATE programs SET ${updates.join(', ')} WHERE id = ?`, params);
}

export async function deleteProgram(id: number): Promise<{
  images: ProgramImage[];
  poster_r2_key: string | null;
  thumbnail_r2_key: string | null;
} | null> {
  const program = await getProgramById(id);
  if (!program) return null;

  const images = program.images;
  // CASCADE removes program_images rows; applications.program_id set NULL.
  await executeD1('DELETE FROM programs WHERE id = ?', [id]);

  return {
    images,
    poster_r2_key: program.poster_r2_key,
    thumbnail_r2_key: program.thumbnail_r2_key,
  };
}

export async function incrementProgramViewCount(id: number): Promise<void> {
  await executeD1('UPDATE programs SET view_count = view_count + 1 WHERE id = ?', [id]);
}

// ============================================
// Program Images
// ============================================

export async function getProgramImages(programId: number): Promise<ProgramImage[]> {
  return queryD1<ProgramImage>(
    'SELECT * FROM program_images WHERE program_id = ? ORDER BY sort_order ASC',
    [programId]
  );
}

export async function createProgramImage(
  programId: number,
  input: CreateProgramImageInput
): Promise<number> {
  const maxOrder = await queryD1<{ max_order: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM program_images WHERE program_id = ?',
    [programId]
  );
  const sortOrder = (maxOrder[0]?.max_order ?? -1) + 1;

  const { lastRowId } = await executeD1(
    `INSERT INTO program_images (
      program_id, image_url, r2_key, sort_order,
      caption_ko, caption_en, width, height, size
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      programId,
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

export async function updateProgramImageOrder(
  programId: number,
  imageIds: number[]
): Promise<void> {
  for (let i = 0; i < imageIds.length; i++) {
    await executeD1(
      'UPDATE program_images SET sort_order = ? WHERE id = ? AND program_id = ?',
      [i, imageIds[i], programId]
    );
  }
}

export async function deleteProgramImage(id: number): Promise<ProgramImage | null> {
  const images = await queryD1<ProgramImage>(
    'SELECT * FROM program_images WHERE id = ?',
    [id]
  );
  if (images.length === 0) return null;

  await executeD1('DELETE FROM program_images WHERE id = ?', [id]);
  return images[0];
}

export async function deleteAllProgramImages(programId: number): Promise<ProgramImage[]> {
  const images = await getProgramImages(programId);
  await executeD1('DELETE FROM program_images WHERE program_id = ?', [programId]);
  return images;
}
