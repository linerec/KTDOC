/**
 * lib/mail/attachments.test.ts — "붙여도 되는가"를 잠근다
 *
 * 화면과 라우트가 같은 함수를 쓰므로, 여기가 뒤집히면 두 곳이 함께 뒤집힌다.
 * 특히 다음이 무너지면 사고다:
 *  - 실행 파일이 통과 → 받는 쪽 게이트웨이가 메일을 통째로 버린다("보냈는데 안 왔다")
 *  - 확장자 검사가 대소문자·이중 확장자에 뚫림 → 위와 같은 결과
 *  - 경로 조각이 파일명에 남음 → provider에 이상한 이름이 나간다
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attachmentExtension,
  checkAttachments,
  describeAttachments,
  safeAttachmentName,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_TOTAL_BYTES,
} from './attachments.ts';

test('보통 파일은 통과한다', () => {
  assert.equal(
    checkAttachments([
      { name: '수강료 안내.pdf', size: 300_000 },
      { name: 'poster.jpg', size: 1_200_000 },
    ]),
    null
  );
});

test('실행 파일은 대소문자와 무관하게 막는다', () => {
  assert.equal(checkAttachments([{ name: 'setup.EXE', size: 100 }])?.kind, 'blocked-type');
  assert.equal(checkAttachments([{ name: 'run.Sh', size: 100 }])?.kind, 'blocked-type');
});

test('이중 확장자는 마지막 것으로 판정한다', () => {
  // 'invoice.pdf.exe'는 pdf가 아니다 — 앞부분에 속으면 안 된다
  assert.equal(checkAttachments([{ name: 'invoice.pdf.exe', size: 100 }])?.kind, 'blocked-type');
  assert.equal(checkAttachments([{ name: 'invoice.exe.pdf', size: 100 }]), null);
});

test('압축 파일은 허용한다 — 사진 묶음이 실제로 이 형태로 온다', () => {
  assert.equal(checkAttachments([{ name: 'photos.zip', size: 2_000_000 }]), null);
});

test('개수·개별 크기·합계 상한을 각각 지킨다', () => {
  const many = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, i) => ({
    name: `f${i}.pdf`,
    size: 1000,
  }));
  assert.equal(checkAttachments(many)?.kind, 'too-many');

  assert.equal(
    checkAttachments([{ name: 'big.pdf', size: MAX_ATTACHMENT_BYTES + 1 }])?.kind,
    'file-too-large'
  );

  // 개별로는 통과하지만 합계가 넘는 조합
  const half = Math.ceil(MAX_ATTACHMENTS_TOTAL_BYTES / 2) + 1;
  assert.equal(
    checkAttachments([
      { name: 'a.pdf', size: Math.min(half, MAX_ATTACHMENT_BYTES) },
      { name: 'b.pdf', size: Math.min(half, MAX_ATTACHMENT_BYTES) },
    ])?.kind,
    'total-too-large'
  );
});

test('빈 파일은 붙이지 않는다 — 받는 쪽에 열리지 않는 첨부가 간다', () => {
  assert.equal(checkAttachments([{ name: 'empty.pdf', size: 0 }])?.kind, 'empty-file');
});

test('파일명에서 경로 조각과 제어문자를 떨어뜨리고 한글은 남긴다', () => {
  assert.equal(safeAttachmentName('C:\\Users\\원장\\수강료 안내.pdf'), '수강료 안내.pdf');
  assert.equal(safeAttachmentName('../../etc/passwd'), 'passwd');
  assert.equal(safeAttachmentName('명단\n.xlsx'), '명단.xlsx');
  assert.equal(safeAttachmentName('   '), '첨부파일');
});

test('확장자가 없으면 형식으로 막지 않는다', () => {
  assert.equal(attachmentExtension('README'), '');
  assert.equal(checkAttachments([{ name: 'README', size: 100 }]), null);
});

test('요약 한 줄은 이름과 크기를 함께 말한다', () => {
  assert.equal(
    describeAttachments([{ name: 'a.pdf', size: 2 * 1024 * 1024 }]),
    'a.pdf (2.0MB)'
  );
});
