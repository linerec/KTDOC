/**
 * lib/print/bannerMail.test.ts — 회신이 메일 한 통이 되는 마지막 구간
 *
 * 회신은 저장되지 않으므로 이 메일이 유일한 기록이다. 본문에서 적으신 말이
 * 빠지면 회신을 받고도 무슨 말씀인지 알 수 없다 — 그 한 가지를 잠근다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMailBody } from '../mail/templates/index.ts';
import { parseBannerFeedback } from './bannerConfirm.ts';

function render(raw: unknown) {
  const parsed = parseBannerFeedback(raw);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error('unreachable');
  return renderMailBody('print.feedback', 'staff', {
    title: '퍼레이드 배너 · 북 배너',
    message: parsed.value.note,
  });
}

test('적으신 말이 본문에 그대로 실린다', () => {
  const mail = render({
    note: '북 배너는 두 장 필요합니다.\n1폭은 28인치가 맞습니다.',
  });
  assert.match(mail.text, /북 배너는 두 장 필요합니다/);
  assert.match(mail.text, /28인치가 맞습니다/);
});

test('제목만 보고도 무엇에 대한 회신인지 안다', () => {
  const mail = render({ note: '확인했습니다.' });
  assert.match(mail.subject, /도안 회신/);
  assert.match(mail.subject, /배너/);
});
