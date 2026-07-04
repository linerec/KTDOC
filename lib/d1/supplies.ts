/**
 * Supplies (준비물) D1 Database Queries
 * 재사용 카탈로그(supply_items) + 이벤트/수업 연결(event_supplies, program_supplies).
 */

import { queryD1, executeD1 } from './client';
import type {
  SupplyItem,
  SupplyItemWithTerm,
  SupplyItemFilters,
  CreateSupplyItemInput,
  UpdateSupplyItemInput,
  SupplyLinkWithItem,
  SupplyLinkInput,
  SupplySet,
  SupplySetWithItems,
  SupplySetMemberItem,
  SupplySetFilters,
  CreateSupplySetInput,
  UpdateSupplySetInput,
  SupplySetLinkInput,
  SupplySetLinkWithItems,
} from '@/types/supplies';
import { generateSlug } from '@/types/supplies';

// ============================================
// Supply Items (카탈로그)
// ============================================

const ITEM_SELECT = `SELECT s.*,
  t.term_ko as term_ko,
  t.pronunciation as term_pronunciation,
  t.slug as term_slug
 FROM supply_items s
 LEFT JOIN glossary_terms t ON t.id = s.glossary_term_id`;

export async function getSupplyItems(filters: SupplyItemFilters = {}): Promise<{
  items: SupplyItemWithTerm[];
  total: number;
}> {
  const { search, active = 'all', limit = 500, page = 1 } = filters;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (active === true) {
    conditions.push('s.is_active = 1');
  } else if (active === false) {
    conditions.push('s.is_active = 0');
  }

  if (search) {
    conditions.push('(s.name_ko LIKE ? OR s.name_en LIKE ? OR s.description_ko LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryD1<{ count: number }>(
    `SELECT COUNT(*) as count FROM supply_items s ${whereClause}`,
    params
  );
  const total = countResult[0]?.count || 0;

  const offset = (page - 1) * limit;
  const items = await queryD1<SupplyItemWithTerm>(
    `${ITEM_SELECT} ${whereClause}
     ORDER BY s.sort_order ASC, s.name_ko ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items, total };
}

export async function getSupplyItemById(id: number): Promise<SupplyItemWithTerm | null> {
  const rows = await queryD1<SupplyItemWithTerm>(`${ITEM_SELECT} WHERE s.id = ?`, [id]);
  return rows[0] || null;
}

export async function createSupplyItem(input: CreateSupplyItemInput): Promise<number> {
  const slug = input.slug || generateSlug(input.name_en || input.name_ko);
  const { lastRowId } = await executeD1(
    `INSERT INTO supply_items (
      slug, name_ko, name_en, description_ko, description_en,
      image_url, image_r2_key, glossary_term_id, is_active, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      input.name_ko,
      input.name_en || null,
      input.description_ko || null,
      input.description_en || null,
      input.image_url || null,
      input.image_r2_key || null,
      input.glossary_term_id ?? null,
      input.is_active === false ? 0 : 1,
      input.sort_order ?? 0,
    ]
  );
  return lastRowId;
}

export async function updateSupplyItem(id: number, input: UpdateSupplyItemInput): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];

  const setText = (key: keyof UpdateSupplyItemInput, column?: string) => {
    if (input[key] !== undefined) {
      updates.push(`${column || key} = ?`);
      params.push((input[key] as string | undefined) || null);
    }
  };

  if (input.name_ko !== undefined) {
    updates.push('name_ko = ?');
    params.push(input.name_ko);
  }
  setText('name_en');
  setText('description_ko');
  setText('description_en');
  setText('image_url');
  setText('image_r2_key');
  if (input.slug !== undefined) {
    updates.push('slug = ?');
    params.push(input.slug);
  }
  if (input.glossary_term_id !== undefined) {
    updates.push('glossary_term_id = ?');
    params.push(input.glossary_term_id ?? null);
  }
  if (input.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(input.is_active ? 1 : 0);
  }
  if (input.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sort_order);
  }

  if (updates.length === 0) return;

  updates.push("updated_at = datetime('now')");
  params.push(id);
  await executeD1(`UPDATE supply_items SET ${updates.join(', ')} WHERE id = ?`, params);
}

/** 카탈로그 항목 삭제. 이벤트/수업 연결은 FK CASCADE로 함께 제거된다. 이미지 R2 정리를 위해 키 반환. */
export async function deleteSupplyItem(id: number): Promise<{ image_r2_key: string | null } | null> {
  const item = await getSupplyItemById(id);
  if (!item) return null;
  await executeD1('DELETE FROM supply_items WHERE id = ?', [id]);
  return { image_r2_key: item.image_r2_key };
}

// ============================================
// Links (이벤트/수업 ↔ 준비물)
// ============================================

const LINK_SELECT_COLS = `l.id, l.supply_item_id, l.quantity, l.note_ko, l.note_en,
  l.is_required, l.sort_order,
  s.name_ko as name_ko, s.name_en as name_en,
  s.description_ko as description_ko, s.description_en as description_en,
  s.image_url as image_url,
  t.slug as term_slug, t.pronunciation as term_pronunciation`;

export async function getEventSupplies(eventId: number): Promise<SupplyLinkWithItem[]> {
  return queryD1<SupplyLinkWithItem>(
    `SELECT ${LINK_SELECT_COLS}
     FROM event_supplies l
     JOIN supply_items s ON s.id = l.supply_item_id
     LEFT JOIN glossary_terms t ON t.id = s.glossary_term_id
     WHERE l.event_id = ?
     ORDER BY l.sort_order ASC, l.id ASC`,
    [eventId]
  );
}

export async function getProgramSupplies(programId: number): Promise<SupplyLinkWithItem[]> {
  return queryD1<SupplyLinkWithItem>(
    `SELECT ${LINK_SELECT_COLS}
     FROM program_supplies l
     JOIN supply_items s ON s.id = l.supply_item_id
     LEFT JOIN glossary_terms t ON t.id = s.glossary_term_id
     WHERE l.program_id = ?
     ORDER BY l.sort_order ASC, l.id ASC`,
    [programId]
  );
}

async function replaceLinks(
  table: 'event_supplies' | 'program_supplies',
  ownerColumn: 'event_id' | 'program_id',
  ownerId: number,
  links: SupplyLinkInput[]
): Promise<void> {
  await executeD1(`DELETE FROM ${table} WHERE ${ownerColumn} = ?`, [ownerId]);
  // 같은 카탈로그 항목이 중복 선택돼도 UNIQUE 제약을 어기지 않도록 한 번만 남긴다.
  const seen = new Set<number>();
  let order = 0;
  for (const link of links) {
    if (!link.supply_item_id || seen.has(link.supply_item_id)) continue;
    seen.add(link.supply_item_id);
    await executeD1(
      `INSERT INTO ${table}
        (${ownerColumn}, supply_item_id, quantity, note_ko, note_en, is_required, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        link.supply_item_id,
        link.quantity || null,
        link.note_ko || null,
        link.note_en || null,
        link.is_required === false ? 0 : 1,
        order++,
      ]
    );
  }
}

export async function setEventSupplies(eventId: number, links: SupplyLinkInput[]): Promise<void> {
  await replaceLinks('event_supplies', 'event_id', eventId, links);
}

export async function setProgramSupplies(programId: number, links: SupplyLinkInput[]): Promise<void> {
  await replaceLinks('program_supplies', 'program_id', programId, links);
}

/** 폼 선택기용 — 활성 카탈로그 항목 전량(가벼운 필드만). */
export async function getActiveSupplyItems(): Promise<SupplyItem[]> {
  return queryD1<SupplyItem>(
    'SELECT * FROM supply_items WHERE is_active = 1 ORDER BY sort_order ASC, name_ko ASC'
  );
}

// ============================================
// Supply Sets (준비물 세트)
// ============================================

/** 여러 세트의 구성 항목을 한 번에 로드해 set_id별로 묶는다. */
async function getMembersForSets(setIds: number[]): Promise<Map<number, SupplySetMemberItem[]>> {
  const map = new Map<number, SupplySetMemberItem[]>();
  if (setIds.length === 0) return map;
  const placeholders = setIds.map(() => '?').join(', ');
  const rows = await queryD1<SupplySetMemberItem & { set_id: number }>(
    `SELECT si.set_id as set_id,
            si.supply_item_id as supply_item_id,
            s.name_ko as name_ko, s.name_en as name_en, s.image_url as image_url,
            t.slug as term_slug, t.pronunciation as term_pronunciation
     FROM supply_set_items si
     JOIN supply_items s ON s.id = si.supply_item_id
     LEFT JOIN glossary_terms t ON t.id = s.glossary_term_id
     WHERE si.set_id IN (${placeholders})
     ORDER BY si.set_id ASC, si.sort_order ASC`,
    setIds
  );
  for (const r of rows) {
    const { set_id, ...member } = r;
    const list = map.get(set_id) ?? [];
    list.push(member);
    map.set(set_id, list);
  }
  return map;
}

export async function getSupplySets(filters: SupplySetFilters = {}): Promise<{
  sets: SupplySetWithItems[];
  total: number;
}> {
  const { search, active = 'all', limit = 500, page = 1 } = filters;

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (active === true) conditions.push('is_active = 1');
  else if (active === false) conditions.push('is_active = 0');
  if (search) {
    conditions.push('(name_ko LIKE ? OR name_en LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryD1<{ count: number }>(
    `SELECT COUNT(*) as count FROM supply_sets ${whereClause}`,
    params
  );
  const total = countResult[0]?.count || 0;

  const offset = (page - 1) * limit;
  const rows = await queryD1<SupplySet>(
    `SELECT * FROM supply_sets ${whereClause}
     ORDER BY sort_order ASC, name_ko ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const membersMap = await getMembersForSets(rows.map((s) => s.id));
  const sets = rows.map((s) => ({ ...s, items: membersMap.get(s.id) ?? [] }));

  return { sets, total };
}

export async function getSupplySetById(id: number): Promise<SupplySetWithItems | null> {
  const rows = await queryD1<SupplySet>('SELECT * FROM supply_sets WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  const membersMap = await getMembersForSets([id]);
  return { ...rows[0], items: membersMap.get(id) ?? [] };
}

/** 폼 선택기용 — 활성 세트 전량 + 구성 항목. */
export async function getActiveSupplySets(): Promise<SupplySetWithItems[]> {
  const { sets } = await getSupplySets({ active: true, limit: 500 });
  return sets;
}

async function replaceSetMembers(setId: number, itemIds: number[]): Promise<void> {
  await executeD1('DELETE FROM supply_set_items WHERE set_id = ?', [setId]);
  const seen = new Set<number>();
  let order = 0;
  for (const itemId of itemIds) {
    const id = Number(itemId);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    await executeD1(
      'INSERT INTO supply_set_items (set_id, supply_item_id, sort_order) VALUES (?, ?, ?)',
      [setId, id, order++]
    );
  }
}

export async function createSupplySet(input: CreateSupplySetInput): Promise<number> {
  const slug = input.slug || generateSlug(input.name_en || input.name_ko);
  const { lastRowId } = await executeD1(
    `INSERT INTO supply_sets (slug, name_ko, name_en, description_ko, description_en, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      input.name_ko,
      input.name_en || null,
      input.description_ko || null,
      input.description_en || null,
      input.is_active === false ? 0 : 1,
      input.sort_order ?? 0,
    ]
  );
  if (input.item_ids) {
    await replaceSetMembers(lastRowId, input.item_ids);
  }
  return lastRowId;
}

export async function updateSupplySet(id: number, input: UpdateSupplySetInput): Promise<void> {
  const updates: string[] = [];
  const params: unknown[] = [];

  const setText = (key: keyof UpdateSupplySetInput, column?: string) => {
    if (input[key] !== undefined) {
      updates.push(`${column || key} = ?`);
      params.push((input[key] as string | undefined) || null);
    }
  };

  if (input.name_ko !== undefined) {
    updates.push('name_ko = ?');
    params.push(input.name_ko);
  }
  setText('name_en');
  setText('description_ko');
  setText('description_en');
  if (input.slug !== undefined) {
    updates.push('slug = ?');
    params.push(input.slug);
  }
  if (input.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(input.is_active ? 1 : 0);
  }
  if (input.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sort_order);
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);
    await executeD1(`UPDATE supply_sets SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  if (input.item_ids !== undefined) {
    await replaceSetMembers(id, input.item_ids);
  }
}

export async function deleteSupplySet(id: number): Promise<boolean> {
  const rows = await queryD1<{ id: number }>('SELECT id FROM supply_sets WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) return false;
  // CASCADE가 supply_set_items 및 event/program 연결을 함께 제거한다.
  await executeD1('DELETE FROM supply_sets WHERE id = ?', [id]);
  return true;
}

// ── 이벤트/수업 ↔ 세트 연결 ──

const SET_LINK_COLS = `l.id, l.supply_set_id, l.quantity, l.note_ko, l.note_en,
  l.is_required, l.sort_order,
  ss.name_ko as name_ko, ss.name_en as name_en,
  ss.description_ko as description_ko, ss.description_en as description_en`;

async function loadSetLinks(
  table: 'event_supply_sets' | 'program_supply_sets',
  ownerColumn: 'event_id' | 'program_id',
  ownerId: number
): Promise<SupplySetLinkWithItems[]> {
  const rows = await queryD1<Omit<SupplySetLinkWithItems, 'items'>>(
    `SELECT ${SET_LINK_COLS}
     FROM ${table} l
     JOIN supply_sets ss ON ss.id = l.supply_set_id
     WHERE l.${ownerColumn} = ?
     ORDER BY l.sort_order ASC, l.id ASC`,
    [ownerId]
  );
  const membersMap = await getMembersForSets(rows.map((r) => r.supply_set_id));
  return rows.map((r) => ({ ...r, items: membersMap.get(r.supply_set_id) ?? [] }));
}

export async function getEventSupplySets(eventId: number): Promise<SupplySetLinkWithItems[]> {
  return loadSetLinks('event_supply_sets', 'event_id', eventId);
}

export async function getProgramSupplySets(programId: number): Promise<SupplySetLinkWithItems[]> {
  return loadSetLinks('program_supply_sets', 'program_id', programId);
}

async function replaceSetLinks(
  table: 'event_supply_sets' | 'program_supply_sets',
  ownerColumn: 'event_id' | 'program_id',
  ownerId: number,
  links: SupplySetLinkInput[]
): Promise<void> {
  await executeD1(`DELETE FROM ${table} WHERE ${ownerColumn} = ?`, [ownerId]);
  const seen = new Set<number>();
  let order = 0;
  for (const link of links) {
    if (!link.supply_set_id || seen.has(link.supply_set_id)) continue;
    seen.add(link.supply_set_id);
    await executeD1(
      `INSERT INTO ${table}
        (${ownerColumn}, supply_set_id, quantity, note_ko, note_en, is_required, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        link.supply_set_id,
        link.quantity || null,
        link.note_ko || null,
        link.note_en || null,
        link.is_required === false ? 0 : 1,
        order++,
      ]
    );
  }
}

export async function setEventSupplySets(eventId: number, links: SupplySetLinkInput[]): Promise<void> {
  await replaceSetLinks('event_supply_sets', 'event_id', eventId, links);
}

export async function setProgramSupplySets(programId: number, links: SupplySetLinkInput[]): Promise<void> {
  await replaceSetLinks('program_supply_sets', 'program_id', programId, links);
}
