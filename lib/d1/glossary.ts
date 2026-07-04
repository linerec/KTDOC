/**
 * Glossary (말모이) D1 Database Queries
 * 한국 전통무용 용어 사전 데이터베이스 쿼리 (lib/d1/gallery.ts 규약을 따름)
 */

import { queryD1, executeD1 } from './client';
import type {
  GlossaryTerm,
  GlossaryTermWithCategory,
  GlossaryCategoryWithCount,
  GlossaryFilters,
  CreateGlossaryTermInput,
  UpdateGlossaryTermInput,
  CreateGlossaryCategoryInput,
  UpdateGlossaryCategoryInput,
} from '@/types/glossary';
import { generateSlug } from '@/types/glossary';

// ============================================
// Categories
// ============================================

export async function getGlossaryCategories(): Promise<GlossaryCategoryWithCount[]> {
  return queryD1<GlossaryCategoryWithCount>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM glossary_terms t WHERE t.category_id = c.id) as term_count
     FROM glossary_categories c
     ORDER BY c.sort_order ASC, c.id ASC`
  );
}

export async function createGlossaryCategory(
  input: CreateGlossaryCategoryInput
): Promise<number> {
  const slug = input.slug || generateSlug(input.name_en || input.name_ko);
  const { lastRowId } = await executeD1(
    `INSERT INTO glossary_categories (slug, name_ko, name_en, sort_order)
     VALUES (?, ?, ?, ?)`,
    [slug, input.name_ko, input.name_en || null, input.sort_order ?? 0]
  );
  return lastRowId;
}

export async function updateGlossaryCategory(
  id: number,
  input: UpdateGlossaryCategoryInput
): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];
  if (input.name_ko !== undefined) {
    updates.push('name_ko = ?');
    params.push(input.name_ko);
  }
  if (input.name_en !== undefined) {
    updates.push('name_en = ?');
    params.push(input.name_en || null);
  }
  if (input.slug !== undefined) {
    updates.push('slug = ?');
    params.push(input.slug);
  }
  if (input.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sort_order);
  }
  if (updates.length === 0) return;
  params.push(id);
  await executeD1(`UPDATE glossary_categories SET ${updates.join(', ')} WHERE id = ?`, params);
}

/** 분류 삭제. 용어의 category_id는 스키마 FK(ON DELETE SET NULL)로 자동 해제된다. */
export async function deleteGlossaryCategory(id: number): Promise<void> {
  await executeD1('DELETE FROM glossary_categories WHERE id = ?', [id]);
}

// ============================================
// Terms
// ============================================

export async function getGlossaryTerms(filters: GlossaryFilters = {}): Promise<{
  terms: GlossaryTermWithCategory[];
  total: number;
}> {
  const { categoryId, search, published = true, limit = 500, page = 1 } = filters;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (published === true) {
    conditions.push('t.is_published = 1');
  } else if (published === false) {
    conditions.push('t.is_published = 0');
  }

  if (categoryId) {
    conditions.push('t.category_id = ?');
    params.push(categoryId);
  }

  if (search) {
    conditions.push(
      `(t.term_ko LIKE ? OR t.term_en LIKE ? OR t.romanization LIKE ?
        OR t.pronunciation LIKE ? OR t.definition_ko LIKE ? OR t.definition_en LIKE ?)`
    );
    const term = `%${search}%`;
    params.push(term, term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryD1<{ count: number }>(
    `SELECT COUNT(*) as count FROM glossary_terms t ${whereClause}`,
    params
  );
  const total = countResult[0]?.count || 0;

  const offset = (page - 1) * limit;
  const terms = await queryD1<GlossaryTermWithCategory>(
    `SELECT t.*,
            c.name_ko as category_name_ko,
            c.name_en as category_name_en,
            c.slug as category_slug
     FROM glossary_terms t
     LEFT JOIN glossary_categories c ON c.id = t.category_id
     ${whereClause}
     ORDER BY t.sort_order ASC, t.term_ko ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { terms, total };
}

export async function getGlossaryTermById(id: number): Promise<GlossaryTermWithCategory | null> {
  const rows = await queryD1<GlossaryTermWithCategory>(
    `SELECT t.*,
            c.name_ko as category_name_ko,
            c.name_en as category_name_en,
            c.slug as category_slug
     FROM glossary_terms t
     LEFT JOIN glossary_categories c ON c.id = t.category_id
     WHERE t.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function createGlossaryTerm(input: CreateGlossaryTermInput): Promise<number> {
  const slug = input.slug || generateSlug(input.romanization || input.term_en || input.term_ko);

  const { lastRowId } = await executeD1(
    `INSERT INTO glossary_terms (
      slug, term_ko, term_en, romanization, pronunciation,
      definition_ko, definition_en, example_ko, example_en,
      category_id, is_published, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      input.term_ko,
      input.term_en || null,
      input.romanization || null,
      input.pronunciation || null,
      input.definition_ko || null,
      input.definition_en || null,
      input.example_ko || null,
      input.example_en || null,
      input.category_id ?? null,
      input.is_published === false ? 0 : 1,
      input.sort_order ?? 0,
    ]
  );

  return lastRowId;
}

export async function updateGlossaryTerm(
  id: number,
  input: UpdateGlossaryTermInput
): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];

  const setText = (key: keyof UpdateGlossaryTermInput, column?: string) => {
    if (input[key] !== undefined) {
      updates.push(`${column || key} = ?`);
      params.push((input[key] as string | undefined) || null);
    }
  };

  if (input.term_ko !== undefined) {
    updates.push('term_ko = ?');
    params.push(input.term_ko);
  }
  setText('term_en');
  setText('romanization');
  setText('pronunciation');
  setText('definition_ko');
  setText('definition_en');
  setText('example_ko');
  setText('example_en');
  setText('image_url');
  setText('image_r2_key');
  if (input.slug !== undefined) {
    updates.push('slug = ?');
    params.push(input.slug);
  }
  if (input.category_id !== undefined) {
    updates.push('category_id = ?');
    params.push(input.category_id ?? null);
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

  await executeD1(`UPDATE glossary_terms SET ${updates.join(', ')} WHERE id = ?`, params);
}

/** 용어 삭제. 첨부 이미지 R2 정리를 위해 image_r2_key를 반환한다. */
export async function deleteGlossaryTerm(id: number): Promise<{ image_r2_key: string | null } | null> {
  const term = await getGlossaryTermById(id);
  if (!term) return null;
  await executeD1('DELETE FROM glossary_terms WHERE id = ?', [id]);
  return { image_r2_key: term.image_r2_key };
}

export async function incrementGlossaryViewCount(id: number): Promise<void> {
  await executeD1('UPDATE glossary_terms SET view_count = view_count + 1 WHERE id = ?', [id]);
}

/** 준비물 등 다른 도메인에서 용어를 연결할 때 쓰는 경량 조회(발음/뜻만). */
export async function getGlossaryTermsByIds(ids: number[]): Promise<GlossaryTerm[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  return queryD1<GlossaryTerm>(
    `SELECT * FROM glossary_terms WHERE id IN (${placeholders})`,
    ids
  );
}
