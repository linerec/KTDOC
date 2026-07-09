/**
 * D1 Site Settings 데이터 관리
 *
 * 관리자가 편집할 수 있는 사이트 전역 설정을 키-값으로 저장한다.
 * (예: 홈 Hero 섹션에서 큰 메인 썸네일로 노출할 유튜브 영상)
 */

import { queryD1, executeD1 } from './client';

/** Hero 섹션의 대표(메인) 영상으로 고정할 유튜브 videoId */
export const SETTING_HERO_FEATURED_VIDEO = 'hero.featured_video_id';

/** 헤더(Top Bar) 배경 색상/투명도. JSON: {top:{color,opacity}, scrolled:{color,opacity}} */
export const SETTING_HEADER_BACKGROUND = 'header.background';

/** Hero 배경 톤·필터. JSON: {imageOpacity, dim, tintColor, tintStrength, tintBlend} */
export const SETTING_HERO_OVERLAY = 'hero.overlay';

/**
 * 구독형 캘린더 피드(/calendar.ics) 설정. JSON 직렬화:
 * {name, description, timezone, enabled, includeEvents, includeCamps}
 */
export const SETTING_CALENDAR_CONFIG = 'calendar.config';

// 'seo.business' (SEO 비즈니스 정보/NAP) 키는 클라이언트 안전 모듈인
// lib/seoBusiness.ts의 SETTING_SEO_BUSINESS에 정의되어 있다(타입·파서·JSON-LD 빌더 동거).

interface SettingRow {
  setting_key: string;
  setting_value: string | null;
}

/**
 * 단일 설정값 조회. 없으면 null.
 */
export async function getSetting(key: string): Promise<string | null> {
  const rows = await queryD1<SettingRow>(
    'SELECT setting_value FROM site_settings WHERE setting_key = ?',
    [key]
  );
  return rows[0]?.setting_value ?? null;
}

/**
 * 여러 설정값을 한 번에 조회. { key: value } 형태로 반환 (값이 null인 키는 제외).
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const placeholders = keys.map(() => '?').join(', ');
  const rows = await queryD1<SettingRow>(
    `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (${placeholders})`,
    keys
  );

  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.setting_value != null) {
      result[row.setting_key] = row.setting_value;
    }
  }
  return result;
}

/**
 * 설정값 저장 (upsert). value가 null이면 빈 값으로 저장(= 자동/기본값으로 복원).
 */
export async function setSetting(key: string, value: string | null): Promise<void> {
  const existing = await queryD1<SettingRow>(
    'SELECT setting_key FROM site_settings WHERE setting_key = ?',
    [key]
  );

  if (existing.length > 0) {
    await executeD1(
      `UPDATE site_settings
       SET setting_value = ?, updated_at = datetime('now')
       WHERE setting_key = ?`,
      [value, key]
    );
  } else {
    await executeD1(
      'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)',
      [key, value]
    );
  }
}
