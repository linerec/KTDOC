/**
 * D1 Images 데이터 관리
 */

import { queryD1, executeD1 } from './client';

export interface ImageData {
  id: number;
  keycode: string;
  url: string;
  r2_key: string;
  alt_ko: string | null;
  alt_en: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  content_type: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 모든 이미지 데이터 조회
 */
export async function getAllImages(): Promise<ImageData[]> {
  return await queryD1<ImageData>('SELECT * FROM images ORDER BY keycode');
}

/**
 * 특정 키코드의 이미지 데이터 조회
 */
export async function getImageByKeycode(keycode: string): Promise<ImageData | null> {
  const results = await queryD1<ImageData>(
    'SELECT * FROM images WHERE keycode = ?',
    [keycode]
  );
  return results[0] || null;
}

/**
 * 이미지 데이터 생성 또는 업데이트 (upsert)
 */
export async function upsertImage(data: {
  keycode: string;
  url: string;
  r2_key: string;
  alt_ko?: string;
  alt_en?: string;
  width?: number;
  height?: number;
  size?: number;
  content_type?: string;
}): Promise<{ success: boolean; isNew: boolean }> {
  const existing = await getImageByKeycode(data.keycode);

  if (existing) {
    await executeD1(
      `UPDATE images SET
        url = ?, r2_key = ?, alt_ko = ?, alt_en = ?,
        width = ?, height = ?, size = ?, content_type = ?,
        updated_at = datetime('now')
      WHERE keycode = ?`,
      [
        data.url,
        data.r2_key,
        data.alt_ko || null,
        data.alt_en || null,
        data.width || null,
        data.height || null,
        data.size || null,
        data.content_type || null,
        data.keycode,
      ]
    );
    return { success: true, isNew: false };
  } else {
    await executeD1(
      `INSERT INTO images (keycode, url, r2_key, alt_ko, alt_en, width, height, size, content_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.keycode,
        data.url,
        data.r2_key,
        data.alt_ko || null,
        data.alt_en || null,
        data.width || null,
        data.height || null,
        data.size || null,
        data.content_type || null,
      ]
    );
    return { success: true, isNew: true };
  }
}

/**
 * 이미지 삭제
 */
export async function deleteImage(keycode: string): Promise<boolean> {
  const result = await executeD1(
    'DELETE FROM images WHERE keycode = ?',
    [keycode]
  );
  return result.changes > 0;
}
