/**
 * News D1 Database Queries
 * 뉴스·미디어(/media) 게시물 데이터베이스 쿼리
 */

import { queryD1, executeD1 } from './client';
import type {
  NewsPost,
  NewsFilters,
  CreateNewsPostInput,
  UpdateNewsPostInput,
} from '@/types/news';

export async function getNewsPosts(filters: NewsFilters = {}): Promise<{
  posts: NewsPost[];
  total: number;
}> {
  const { category, search, page = 1, limit = 20, published = true } = filters;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (published === true) {
    conditions.push('is_published = 1');
  } else if (published === false) {
    conditions.push('is_published = 0');
  }

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (search) {
    conditions.push('(title_ko LIKE ? OR title_en LIKE ? OR body_ko LIKE ? OR body_en LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryD1<{ count: number }>(
    `SELECT COUNT(*) as count FROM news_posts ${whereClause}`,
    params
  );
  const total = countResult[0]?.count || 0;

  const offset = (page - 1) * limit;
  const posts = await queryD1<NewsPost>(
    `SELECT * FROM news_posts
     ${whereClause}
     ORDER BY COALESCE(published_at, substr(created_at, 1, 10)) DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { posts, total };
}

export async function getNewsPostById(id: number): Promise<NewsPost | null> {
  const results = await queryD1<NewsPost>(
    'SELECT * FROM news_posts WHERE id = ?',
    [id]
  );
  return results[0] || null;
}

export async function createNewsPost(input: CreateNewsPostInput): Promise<number> {
  const { lastRowId } = await executeD1(
    `INSERT INTO news_posts (
       category, title_ko, title_en, body_ko, body_en,
       source_name, external_url, youtube_url, thumbnail_url, thumbnail_r2_key,
       is_published, published_at, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')), ?)`,
    [
      input.category,
      input.title_ko,
      input.title_en || null,
      input.body_ko || null,
      input.body_en || null,
      input.source_name || null,
      input.external_url || null,
      input.youtube_url || null,
      input.thumbnail_url || null,
      input.thumbnail_r2_key || null,
      input.is_published ? 1 : 0,
      input.published_at || null,
      input.created_by || null,
    ]
  );
  return lastRowId;
}

export async function updateNewsPost(
  id: number,
  input: UpdateNewsPostInput
): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.category !== undefined) {
    updates.push('category = ?');
    params.push(input.category);
  }
  if (input.title_ko !== undefined) {
    updates.push('title_ko = ?');
    params.push(input.title_ko);
  }
  if (input.title_en !== undefined) {
    updates.push('title_en = ?');
    params.push(input.title_en || null);
  }
  if (input.body_ko !== undefined) {
    updates.push('body_ko = ?');
    params.push(input.body_ko || null);
  }
  if (input.body_en !== undefined) {
    updates.push('body_en = ?');
    params.push(input.body_en || null);
  }
  if (input.source_name !== undefined) {
    updates.push('source_name = ?');
    params.push(input.source_name || null);
  }
  if (input.external_url !== undefined) {
    updates.push('external_url = ?');
    params.push(input.external_url || null);
  }
  if (input.youtube_url !== undefined) {
    updates.push('youtube_url = ?');
    params.push(input.youtube_url || null);
  }
  if (input.thumbnail_url !== undefined) {
    updates.push('thumbnail_url = ?');
    params.push(input.thumbnail_url || null);
  }
  if (input.thumbnail_r2_key !== undefined) {
    updates.push('thumbnail_r2_key = ?');
    params.push(input.thumbnail_r2_key || null);
  }
  if (input.is_published !== undefined) {
    updates.push('is_published = ?');
    params.push(input.is_published ? 1 : 0);
  }
  if (input.published_at !== undefined) {
    updates.push('published_at = ?');
    params.push(input.published_at || null);
  }

  if (updates.length === 0) return;

  updates.push("updated_at = datetime('now')");
  params.push(id);
  await executeD1(
    `UPDATE news_posts SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
}

export async function deleteNewsPost(id: number): Promise<void> {
  await executeD1('DELETE FROM news_posts WHERE id = ?', [id]);
}
