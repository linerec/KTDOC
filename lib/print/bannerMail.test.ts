/**
 * lib/print/bannerMail.test.ts — 회신이 메일 한 통이 되는 마지막 구간
 *
 * 회신은 저장되지 않으므로 이 메일이 유일한 기록이다. 본문에서 답이 빠지면
 * 회신을 받고도 무슨 답인지 알 수 없다 — 그 한 가지를 잠근다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMailBody } from '../mail/templates/index.ts';
import { parseBannerFeedback, formatBannerFeedback } from './bannerConfirm.ts';

function render(raw: unknown) {
  const parsed = parseBannerFeedback(raw);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error('unreachable');
  return renderMailBody('print.feedback', 'staff', {
    title: '퍼레이드 배너 · 북 배너',
    sender: parsed.value.sender,
    message: formatBannerFeedback(parsed.value),
  });
}

test('고른 답과 남기신 말씀이 본문에 그대로 실린다', () => {
  const mail = render({
    choices: { double_side: 'yes' },
    sizes: { parade_w: '27.5' },
    note: '북 배너는 두 장 필요합니다.',
    sender: '안은희',
  });

  assert.match(mail.text, /양면 인쇄: 양면으로/);
  assert.match(mail.text, /퍼레이드 1폭 가로: 27\.5/);
  assert.match(mail.text, /북 배너는 두 장 필요합니다/);
});

test('보내신 분의 이름이 제목에 들어간다 — 받은 편지함에서 바로 보인다', () => {
  const mail = render({ note: '확인했습니다.', sender: '안은희' });
  assert.match(mail.subject, /안은희/);
});

test('이름을 남기지 않아도 메일은 성립한다', () => {
  const mail = render({ note: '확인했습니다.' });
  assert.ok(mail.subject.length > 0);
  assert.match(mail.text, /확인했습니다/);
});
