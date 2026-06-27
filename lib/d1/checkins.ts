/**
 * 이벤트 체크인(학생 참여) — Cloudflare D1
 *
 * 학생(MySQL users.id)이 자신이 참가한/참가할 이벤트(D1 events.id)에 체크인한다.
 * 체크아웃 = 행 삭제. 저장소가 달라(D1↔MySQL) user_id는 FK 없이 UUID 문자열만 보관하며,
 * 회원 이름은 호출부에서 getUserNamesByIds(MySQL)로 해석한다(gallery_photos.uploaded_by 패턴과 동일).
 *
 * 이 데이터로:
 *  - 학생 본인 아카이브(체크인한 이벤트 + 사진)
 *  - 이벤트별 참여도(참가자 수)
 *  - 연도별 수강생 페이지의 활동 지표
 */

import { queryD1, executeD1 } from './client';
import type {
  CheckedInEvent,
  CheckinStatus,
  EventCheckin,
  EventParticipation,
} from '@/types/gallery';

/**
 * 체크인(멱등). 이미 체크인돼 있으면 상태·메모만 갱신한다.
 * 어떤 이벤트에 체크인을 허용할지(예: 공개된 이벤트만)는 호출부에서 강제한다.
 */
export async function checkInEvent(
  eventId: number,
  userId: string,
  status: CheckinStatus = 'attended',
  note?: string | null
): Promise<void> {
  await executeD1(
    `INSERT INTO event_checkins (event_id, user_id, status, note)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(event_id, user_id)
       DO UPDATE SET status = excluded.status, note = excluded.note`,
    [eventId, userId, status, note ?? null]
  );
}

/** 체크아웃(행 삭제). 본인 것만 지우도록 호출부에서 userId를 강제한다. 삭제 성공 시 true. */
export async function checkOutEvent(eventId: number, userId: string): Promise<boolean> {
  const { changes } = await executeD1(
    'DELETE FROM event_checkins WHERE event_id = ? AND user_id = ?',
    [eventId, userId]
  );
  return changes > 0;
}

/**
 * 체크인 대상 이벤트의 존재·공개 여부(경량). 체크인 API가 "공개 이벤트만" 강제할 때 사용.
 * getEventById는 이미지·영상까지 가져오므로, 검증에는 이 가벼운 조회를 쓴다.
 */
export async function getCheckinEventState(
  eventId: number
): Promise<{ exists: boolean; published: boolean }> {
  const rows = await queryD1<{ is_published: number }>(
    'SELECT is_published FROM events WHERE id = ?',
    [eventId]
  );
  if (rows.length === 0) return { exists: false, published: false };
  return { exists: true, published: rows[0].is_published === 1 };
}

/** 특정 사용자가 이 이벤트에 체크인했는지 */
export async function isCheckedIn(eventId: number, userId: string): Promise<boolean> {
  const rows = await queryD1<{ id: number }>(
    'SELECT id FROM event_checkins WHERE event_id = ? AND user_id = ? LIMIT 1',
    [eventId, userId]
  );
  return rows.length > 0;
}

/** 사용자가 체크인한 이벤트 id 집합 — 둘러보기 목록에서 버튼 상태(체크인/체크아웃) 표시용 */
export async function getUserCheckedInEventIds(userId: string): Promise<Set<number>> {
  const rows = await queryD1<{ event_id: number }>(
    'SELECT event_id FROM event_checkins WHERE user_id = ?',
    [userId]
  );
  return new Set(rows.map((r) => r.event_id));
}

/**
 * 사용자가 체크인한 이벤트 목록(이벤트 상세 + 체크인 메타) — 학생 아카이브.
 * 최신 이벤트(행사일 내림차순)부터.
 */
export async function getUserCheckins(userId: string): Promise<CheckedInEvent[]> {
  return queryD1<CheckedInEvent>(
    `SELECT e.*,
            c.name_ko  AS category_name_ko,
            c.name_en  AS category_name_en,
            c.slug     AS category_slug,
            ec.checked_in_at AS checked_in_at,
            ec.status        AS checkin_status
     FROM event_checkins ec
     JOIN events e ON e.id = ec.event_id
     LEFT JOIN event_categories c ON e.category_id = c.id
     WHERE ec.user_id = ?
     ORDER BY e.event_date DESC, e.id DESC`,
    [userId]
  );
}

/** 특정 이벤트의 체크인(참가자) 행 목록 — 운영진/검증용. 이름 해석은 호출부(MySQL). */
export async function getEventCheckins(eventId: number): Promise<EventCheckin[]> {
  return queryD1<EventCheckin>(
    'SELECT * FROM event_checkins WHERE event_id = ? ORDER BY checked_in_at ASC',
    [eventId]
  );
}

/**
 * 참가 기록이 있는 이벤트 + 참가자 수 — 운영진 참여도 검증 개요.
 * 체크인이 1건 이상인 이벤트만(행사일 내림차순).
 */
export async function getEventsWithParticipantCounts(): Promise<EventParticipation[]> {
  return queryD1<EventParticipation>(
    `SELECT e.id AS event_id, e.title_ko, e.year, e.event_date, e.is_published,
            COUNT(ec.id) AS participant_count
     FROM events e
     JOIN event_checkins ec ON ec.event_id = e.id
     GROUP BY e.id
     ORDER BY e.event_date DESC, e.id DESC`
  );
}

/** 여러 이벤트의 체크인(참가자) 행 — 참가자 명단 구성용(이름 해석은 호출부 MySQL). */
export async function getCheckinsForEvents(eventIds: number[]): Promise<EventCheckin[]> {
  if (eventIds.length === 0) return [];
  const placeholders = eventIds.map(() => '?').join(', ');
  return queryD1<EventCheckin>(
    `SELECT * FROM event_checkins
     WHERE event_id IN (${placeholders})
     ORDER BY checked_in_at ASC`,
    eventIds
  );
}

/** 이벤트별 참가자 수 — 참여도 집계(여러 이벤트 한 번에) */
export async function getCheckinCountsByEvent(
  eventIds: number[]
): Promise<Map<number, number>> {
  if (eventIds.length === 0) return new Map();
  const placeholders = eventIds.map(() => '?').join(', ');
  const rows = await queryD1<{ event_id: number; count: number }>(
    `SELECT event_id, COUNT(*) AS count
     FROM event_checkins
     WHERE event_id IN (${placeholders})
     GROUP BY event_id`,
    eventIds
  );
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.event_id, r.count);
  return map;
}

/** 사용자별 체크인(참여) 수 — 연도별 수강생 페이지의 활동 지표(여러 사용자 한 번에) */
export async function getCheckinCountsByUser(
  userIds: string[]
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const placeholders = userIds.map(() => '?').join(', ');
  const rows = await queryD1<{ user_id: string; count: number }>(
    `SELECT user_id, COUNT(*) AS count
     FROM event_checkins
     WHERE user_id IN (${placeholders})
     GROUP BY user_id`,
    userIds
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.user_id, r.count);
  return map;
}
