/**
 * D1 Locale 데이터 관리
 */

import { queryD1, executeD1 } from './client';

export interface LocaleContent {
  id: number;
  keycode: string;
  ko: string | null;
  en: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocaleMessages {
  [keycode: string]: string;
}

/**
 * 특정 언어의 모든 로케일 데이터 조회
 */
export async function getLocaleMessages(lang: 'ko' | 'en'): Promise<LocaleMessages> {
  const results = await queryD1<LocaleContent>(
    `SELECT keycode, ${lang} as value FROM locale_content`
  );

  const messages: LocaleMessages = {};
  for (const row of results) {
    if ((row as unknown as { value: string }).value) {
      messages[row.keycode] = (row as unknown as { value: string }).value;
    }
  }

  return messages;
}

/**
 * 모든 언어의 로케일 데이터 조회
 */
export async function getAllLocaleMessages(): Promise<{ ko: LocaleMessages; en: LocaleMessages }> {
  const results = await queryD1<LocaleContent>(
    'SELECT keycode, ko, en FROM locale_content'
  );

  const ko: LocaleMessages = {};
  const en: LocaleMessages = {};

  for (const row of results) {
    if (row.ko) ko[row.keycode] = row.ko;
    if (row.en) en[row.keycode] = row.en;
  }

  return { ko, en };
}

/**
 * 특정 키코드의 로케일 데이터 조회
 */
export async function getLocaleByKeycode(keycode: string): Promise<LocaleContent | null> {
  const results = await queryD1<LocaleContent>(
    'SELECT * FROM locale_content WHERE keycode = ?',
    [keycode]
  );

  return results[0] || null;
}

/**
 * 로케일 데이터 생성 또는 업데이트 (upsert)
 */
export async function upsertLocale(
  keycode: string,
  ko: string,
  en: string
): Promise<{ success: boolean; isNew: boolean }> {
  // 기존 데이터 확인
  const existing = await getLocaleByKeycode(keycode);

  if (existing) {
    // 업데이트
    await executeD1(
      `UPDATE locale_content
       SET ko = ?, en = ?, updated_at = datetime('now')
       WHERE keycode = ?`,
      [ko, en, keycode]
    );
    return { success: true, isNew: false };
  } else {
    // 새로 생성
    await executeD1(
      'INSERT INTO locale_content (keycode, ko, en) VALUES (?, ?, ?)',
      [keycode, ko, en]
    );
    return { success: true, isNew: true };
  }
}

/**
 * 로케일 데이터 삭제
 */
export async function deleteLocale(keycode: string): Promise<boolean> {
  const result = await executeD1(
    'DELETE FROM locale_content WHERE keycode = ?',
    [keycode]
  );

  return result.changes > 0;
}

/**
 * 여러 로케일 데이터 일괄 삽입/업데이트
 */
export async function bulkUpsertLocales(
  locales: Array<{ keycode: string; ko: string; en: string }>
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const locale of locales) {
    const result = await upsertLocale(locale.keycode, locale.ko, locale.en);
    if (result.isNew) {
      inserted++;
    } else {
      updated++;
    }
  }

  return { inserted, updated };
}
