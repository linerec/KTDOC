/**
 * 공연 자료함 D1 조회·저장
 *
 * 두 가지를 여기서 지킨다:
 *
 * 1. **목록 질의는 passcode_enc를 select 하지 않는다.** 목록 화면이 비밀번호를
 *    가질 이유가 없고, 실수로 응답에 실릴 통로를 아예 만들지 않는다.
 * 2. **logAccess는 던지지 않는다.** 기록이 실패했다고 재생이 멈추면, 저작권을
 *    지키려고 만든 장치가 공연을 세운다.
 */

import { queryD1, executeD1, batchD1 } from './client';
import { generateResourceCode } from '@/lib/resources/code';
import type { FailureSample } from '@/lib/resources/rateLimit';
import type {
  CreateVaultInput,
  NewResourceItem,
  ResourceAccessAction,
  ResourceAccessEntry,
  ResourceItem,
  ResourceVault,
  ResourceVaultSummary,
  UpdateVaultInput,
} from '@/types/resources';

// ── 행 → 도메인 매핑 ────────────────────────────────────────────────

interface VaultRow {
  id: number;
  code: string;
  title: string;
  note: string | null;
  passcode_enc: string;
  event_id: number | null;
  allow_download: number;
  allow_email: number;
  active: number;
  expires_at: string | null;
  link_epoch: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function toVault(row: VaultRow): ResourceVault {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    note: row.note,
    passcodeEnc: row.passcode_enc,
    eventId: row.event_id,
    allowDownload: row.allow_download === 1,
    allowEmail: row.allow_email === 1,
    active: row.active === 1,
    expiresAt: row.expires_at,
    linkEpoch: row.link_epoch,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ItemRow {
  id: number;
  vault_id: number;
  title: string;
  r2_key: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  sort_order: number;
  created_at: string;
}

function toItem(row: ItemRow): ResourceItem {
  return {
    id: row.id,
    vaultId: row.vault_id,
    title: row.title,
    r2Key: row.r2_key,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    durationSeconds: row.duration_seconds,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// ── 자료함 ──────────────────────────────────────────────────────────

/**
 * 관리 목록 한 판.
 *
 * 파일 수·총 용량은 집계로, 마지막 열람과 최근 실패는 접근 기록에서 가져온다.
 * `passcode_enc`는 **일부러 빼 둔다**(머리말 참고).
 */
export async function listVaults(): Promise<ResourceVaultSummary[]> {
  const rows = await queryD1<{
    id: number;
    code: string;
    title: string;
    event_id: number | null;
    event_title: string | null;
    allow_download: number;
    allow_email: number;
    active: number;
    expires_at: string | null;
    created_at: string;
    item_count: number;
    total_bytes: number;
    last_opened_at: string | null;
    recent_fail_count: number;
  }>(
    `SELECT v.id, v.code, v.title, v.event_id,
            e.title_ko AS event_title,
            v.allow_download, v.allow_email, v.active, v.expires_at, v.created_at,
            (SELECT COUNT(*) FROM resource_items i WHERE i.vault_id = v.id) AS item_count,
            (SELECT COALESCE(SUM(i.size_bytes), 0) FROM resource_items i WHERE i.vault_id = v.id) AS total_bytes,
            (SELECT MAX(l.created_at) FROM resource_access_log l
              WHERE l.vault_id = v.id AND l.action IN ('unlock', 'link_open')) AS last_opened_at,
            (SELECT COUNT(*) FROM resource_access_log l
              WHERE l.vault_id = v.id AND l.action = 'unlock_fail'
                AND l.created_at >= datetime('now', '-10 minutes')) AS recent_fail_count
     FROM resource_vaults v
     LEFT JOIN events e ON v.event_id = e.id
     ORDER BY v.created_at DESC, v.id DESC`
  );

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    eventId: r.event_id,
    eventTitle: r.event_title,
    allowDownload: r.allow_download === 1,
    allowEmail: r.allow_email === 1,
    active: r.active === 1,
    expiresAt: r.expires_at,
    itemCount: Number(r.item_count) || 0,
    totalBytes: Number(r.total_bytes) || 0,
    lastOpenedAt: r.last_opened_at,
    recentFailCount: Number(r.recent_fail_count) || 0,
    createdAt: r.created_at,
  }));
}

export async function getVaultById(id: number): Promise<ResourceVault | null> {
  const rows = await queryD1<VaultRow>('SELECT * FROM resource_vaults WHERE id = ?', [id]);
  return rows[0] ? toVault(rows[0]) : null;
}

export async function getVaultByCode(code: string): Promise<ResourceVault | null> {
  const rows = await queryD1<VaultRow>('SELECT * FROM resource_vaults WHERE code = ?', [code]);
  return rows[0] ? toVault(rows[0]) : null;
}

/**
 * 새 자료함. 번호는 여기서 뽑는다 — 충돌하면 다시 뽑는다.
 *
 * 90만 가지에서 열 번 연속 충돌한다면 그건 운이 아니라 표가 가득 찼다는 뜻이고,
 * 조용히 계속 도는 것보다 던지는 편이 낫다.
 */
export async function createVault(input: CreateVaultInput): Promise<{ id: number; code: string }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateResourceCode();
    const taken = await queryD1<{ id: number }>(
      'SELECT id FROM resource_vaults WHERE code = ? LIMIT 1',
      [code]
    );
    if (taken.length) continue;

    const result = await executeD1(
      `INSERT INTO resource_vaults
         (code, title, note, passcode_enc, event_id, allow_download, allow_email, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        input.title,
        input.note ?? null,
        input.passcodeEnc,
        input.eventId ?? null,
        input.allowDownload === false ? 0 : 1,
        input.allowEmail === false ? 0 : 1,
        input.expiresAt ?? null,
        input.createdBy ?? null,
      ]
    );
    return { id: result.lastRowId, code };
  }
  throw new Error('빈 번호를 찾지 못했습니다. 쓰지 않는 자료함을 정리해 주세요.');
}

export async function updateVault(id: number, patch: UpdateVaultInput): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  const put = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    params.push(value);
  };

  if (patch.title !== undefined) put('title', patch.title);
  if (patch.note !== undefined) put('note', patch.note);
  if (patch.passcodeEnc !== undefined) put('passcode_enc', patch.passcodeEnc);
  if (patch.eventId !== undefined) put('event_id', patch.eventId);
  if (patch.allowDownload !== undefined) put('allow_download', patch.allowDownload ? 1 : 0);
  if (patch.allowEmail !== undefined) put('allow_email', patch.allowEmail ? 1 : 0);
  if (patch.active !== undefined) put('active', patch.active ? 1 : 0);
  if (patch.expiresAt !== undefined) put('expires_at', patch.expiresAt);

  if (!sets.length) return;

  sets.push("updated_at = datetime('now')");
  params.push(id);
  await executeD1(`UPDATE resource_vaults SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteVault(id: number): Promise<void> {
  // 자식 행은 FK CASCADE가 지우지만, D1은 PRAGMA foreign_keys가 꺼져 있을 수
  // 있으므로 직접 지운다 — 고아 행이 남는 쪽이 더 나쁘다.
  await executeD1('DELETE FROM resource_items WHERE vault_id = ?', [id]);
  await executeD1('DELETE FROM resource_vaults WHERE id = ?', [id]);
}

/** 이미 나간 받기 링크를 전부 죽인다 */
export async function bumpLinkEpoch(id: number): Promise<void> {
  await executeD1(
    "UPDATE resource_vaults SET link_epoch = link_epoch + 1, updated_at = datetime('now') WHERE id = ?",
    [id]
  );
}

// ── 파일 ────────────────────────────────────────────────────────────

export async function listItems(vaultId: number): Promise<ResourceItem[]> {
  const rows = await queryD1<ItemRow>(
    'SELECT * FROM resource_items WHERE vault_id = ? ORDER BY sort_order ASC, id ASC',
    [vaultId]
  );
  return rows.map(toItem);
}

export async function getItem(vaultId: number, itemId: number): Promise<ResourceItem | null> {
  const rows = await queryD1<ItemRow>(
    'SELECT * FROM resource_items WHERE vault_id = ? AND id = ?',
    [vaultId, itemId]
  );
  return rows[0] ? toItem(rows[0]) : null;
}

/** 올라온 파일들을 자료함 끝에 붙인다 */
export async function addItems(
  vaultId: number,
  rows: NewResourceItem[]
): Promise<ResourceItem[]> {
  if (!rows.length) return [];

  const max = await queryD1<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM resource_items WHERE vault_id = ?',
    [vaultId]
  );
  let order = Number(max[0]?.next ?? 0);

  for (const row of rows) {
    await executeD1(
      `INSERT INTO resource_items
         (vault_id, title, r2_key, file_name, content_type, size_bytes, duration_seconds, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vaultId,
        row.title,
        row.r2Key,
        row.fileName,
        row.contentType,
        row.sizeBytes,
        row.durationSeconds,
        order,
      ]
    );
    order += 1;
  }

  return listItems(vaultId);
}

export async function updateItem(
  vaultId: number,
  itemId: number,
  patch: { title: string }
): Promise<void> {
  await executeD1('UPDATE resource_items SET title = ? WHERE vault_id = ? AND id = ?', [
    patch.title,
    vaultId,
    itemId,
  ]);
}

export async function deleteItem(vaultId: number, itemId: number): Promise<void> {
  await executeD1('DELETE FROM resource_items WHERE vault_id = ? AND id = ?', [vaultId, itemId]);
}

/**
 * 순서를 통째로 다시 쓴다.
 *
 * batchD1은 롤백이 없다(client.ts 경고). 여기서 쓰는 이유는 **재계산으로
 * 복구되는 쓰기**이기 때문이다 — 중간에 끊겨도 순서가 어긋날 뿐 자료는
 * 그대로고, 다시 끌어 놓으면 낫는다.
 */
export async function reorderItems(vaultId: number, orderedIds: number[]): Promise<void> {
  if (!orderedIds.length) return;
  await batchD1(
    orderedIds.map((id, index) => ({
      sql: 'UPDATE resource_items SET sort_order = ? WHERE vault_id = ? AND id = ?',
      params: [index, vaultId, id],
    }))
  );
}

// ── 접근 기록 ───────────────────────────────────────────────────────

/**
 * 기록을 남긴다. **던지지 않는다** — 기록 실패가 재생을 막으면,
 * 저작권을 지키려고 만든 장치가 공연을 세운다.
 */
export async function logAccess(entry: {
  vaultId: number | null;
  code: string | null;
  action: ResourceAccessAction;
  itemId?: number | null;
  ipHash?: string | null;
  userAgent?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    await executeD1(
      `INSERT INTO resource_access_log (vault_id, code, action, item_id, ip_hash, user_agent, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.vaultId,
        entry.code,
        entry.action,
        entry.itemId ?? null,
        entry.ipHash ?? null,
        entry.userAgent?.slice(0, 300) ?? null,
        entry.detail ?? null,
      ]
    );
  } catch (error) {
    console.error('[resources] 접근 기록 실패:', error);
  }
}

/** 차단 판정이 셀 실패들. rateLimit.ts의 FailureSample 모양 그대로 돌려준다. */
export async function recentFailures(code: string, sinceIso: string): Promise<FailureSample[]> {
  const rows = await queryD1<{ ip_hash: string | null; created_at: string }>(
    `SELECT ip_hash, created_at FROM resource_access_log
      WHERE code = ? AND action = 'unlock_fail' AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT 500`,
    [code, sinceIso]
  );
  return rows.map((r) => ({
    ipHash: r.ip_hash,
    // D1의 datetime('now')는 UTC 'YYYY-MM-DD HH:MM:SS'다 — Z를 붙여야 로컬로 읽히지 않는다
    at: Date.parse(`${r.created_at.replace(' ', 'T')}Z`),
  }));
}

/** 같은 주소로 최근에 몇 번 보냈나 — 발송 남용 방지 */
export async function countRecentEmails(
  vaultId: number,
  email: string,
  sinceIso: string
): Promise<number> {
  const rows = await queryD1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM resource_access_log
      WHERE vault_id = ? AND action = 'email_sent' AND detail = ? AND created_at >= ?`,
    [vaultId, email, sinceIso]
  );
  return Number(rows[0]?.n ?? 0);
}

export async function listAccessLog(vaultId: number, limit = 100): Promise<ResourceAccessEntry[]> {
  const rows = await queryD1<{
    id: number;
    vault_id: number | null;
    code: string | null;
    action: ResourceAccessAction;
    item_id: number | null;
    ip_hash: string | null;
    user_agent: string | null;
    detail: string | null;
    created_at: string;
  }>(
    `SELECT * FROM resource_access_log WHERE vault_id = ?
      ORDER BY created_at DESC, id DESC LIMIT ?`,
    [vaultId, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    vaultId: r.vault_id,
    code: r.code,
    action: r.action,
    itemId: r.item_id,
    ipHash: r.ip_hash,
    userAgent: r.user_agent,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}
