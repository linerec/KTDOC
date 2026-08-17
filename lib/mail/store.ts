/**
 * 메일 설정 저장소 — D1 site_settings의 'mail.config' 키 하나(JSON)
 *
 * 새 설정 테이블을 만들지 않는다. 스키마와 병합 규칙은 config.ts에 있고,
 * 여기는 읽고 쓰는 일만 한다(순수 부분과 나눠야 시험이 붙는다).
 */

import 'server-only';
import { getSetting, setSetting } from '@/lib/d1/settings';
import {
  applyMailConfigPatch,
  mergeMailConfig,
  SETTING_MAIL_CONFIG,
} from './config';
import type { MailConfig } from '@/types/mail';

export async function loadMailConfig(): Promise<MailConfig> {
  const raw = await getSetting(SETTING_MAIL_CONFIG);
  return mergeMailConfig(raw);
}

/** 부분 업데이트 후 저장. 저장된 전체 설정을 돌려준다. */
export async function saveMailConfig(patch: unknown): Promise<MailConfig> {
  const current = await loadMailConfig();
  const next = applyMailConfigPatch(current, patch);
  await setSetting(SETTING_MAIL_CONFIG, JSON.stringify(next));
  return next;
}
