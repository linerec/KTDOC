/**
 * FAQ D1 Database Queries
 * Q&A(자주 묻는 질문) 데이터베이스 쿼리 — 공통·이벤트별 질문/답변
 */

import { queryD1, executeD1 } from './client';
import type { FaqItem, FaqFilters, CreateFaqInput, UpdateFaqInput } from '@/types/faq';

/**
 * Q&A 목록. 공통(event_id NULL) 그룹이 먼저, 이벤트 그룹은 행사일 최신순,
 * 그룹 안에서는 sort_order → id 순으로 정렬된다.
 */
export async function getFaqItems(filters: FaqFilters = {}): Promise<FaqItem[]> {
  const { eventId, published = true } = filters;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (published === true) {
    conditions.push('f.is_published = 1');
  } else if (published === false) {
    conditions.push('f.is_published = 0');
  }

  if (eventId === 'general') {
    conditions.push('f.event_id IS NULL');
  } else if (typeof eventId === 'number') {
    conditions.push('f.event_id = ?');
    params.push(eventId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return queryD1<FaqItem>(
    `SELECT f.*,
            e.title_ko AS event_title_ko,
            e.year AS event_year,
            e.event_date AS event_date
     FROM faq_items f
     LEFT JOIN events e ON f.event_id = e.id
     ${whereClause}
     ORDER BY CASE WHEN f.event_id IS NULL THEN 0 ELSE 1 END,
              e.event_date DESC,
              f.sort_order ASC,
              f.id ASC`,
    params
  );
}

export async function getFaqItemById(id: number): Promise<FaqItem | null> {
  const results = await queryD1<FaqItem>(
    `SELECT f.*,
            e.title_ko AS event_title_ko,
            e.year AS event_year,
            e.event_date AS event_date
     FROM faq_items f
     LEFT JOIN events e ON f.event_id = e.id
     WHERE f.id = ?`,
    [id]
  );
  return results[0] || null;
}

export async function createFaqItem(input: CreateFaqInput): Promise<number> {
  const { lastRowId } = await executeD1(
    `INSERT INTO faq_items (event_id, question, answer, sort_order, is_published, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.event_id ?? null,
      input.question,
      input.answer,
      input.sort_order ?? 0,
      input.is_published === false ? 0 : 1,
      input.created_by || null,
    ]
  );
  return lastRowId;
}

export async function updateFaqItem(id: number, input: UpdateFaqInput): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.event_id !== undefined) {
    updates.push('event_id = ?');
    params.push(input.event_id ?? null);
  }
  if (input.question !== undefined) {
    updates.push('question = ?');
    params.push(input.question);
  }
  if (input.answer !== undefined) {
    updates.push('answer = ?');
    params.push(input.answer);
  }
  if (input.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sort_order);
  }
  if (input.is_published !== undefined) {
    updates.push('is_published = ?');
    params.push(input.is_published ? 1 : 0);
  }

  if (updates.length === 0) return;

  updates.push("updated_at = datetime('now')");
  params.push(id);
  await executeD1(`UPDATE faq_items SET ${updates.join(', ')} WHERE id = ?`, params);
}

export async function deleteFaqItem(id: number): Promise<void> {
  await executeD1('DELETE FROM faq_items WHERE id = ?', [id]);
}
