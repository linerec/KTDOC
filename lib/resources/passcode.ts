/**
 * 자료함 비밀번호 — 해시가 아니라 **가역 암호**로 둔다 (순수 함수)
 *
 * 정석은 bcrypt 해시다. 여기서 벗어나는 이유:
 *
 * 이건 계정 암호가 아니라 **남에게 알려주려고 만든 출입 번호**다. 원장이
 * 나중에 "그 자료함 번호 뭐였지"를 다시 확인하는 것이 정상 업무다. 해시로
 * 두면 잊을 때마다 재설정해야 하고, 그 순간 **이미 알려준 현장 담당자가 전부
 * 막힌다.** 공연 당일에 그 일이 벌어지면 시스템째로 버려진다.
 *
 * 그리고 여기서는 해시가 지키는 것이 실제로 없다. D1이 유출되는 시나리오에서는
 * `resource_items.r2_key`가 함께 나가고, 우리 버킷은 공개라 그 키만으로 파일을
 * 받을 수 있다. 비밀번호만 해시로 지켜 봐야 지킬 것이 남지 않는다.
 *
 * 대신 화면이 "계정 비밀번호와 다른 번호를 쓰세요"를 말하고, 생성 버튼을
 * 직접 입력보다 앞에 둔다.
 *
 * 형식: `v1.<iv>.<tag>.<ciphertext>` (전부 base64url)
 *
 * **모양(길이·생성)은 여기 없다** — lib/resources/passcodeFormat.ts가 갖는다.
 * 그쪽은 브라우저에서도 돌아야 하고, 이 파일의 node:crypto는 브라우저에 없다.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

// 모양은 브라우저와 함께 쓰는 모듈이 갖는다. 여기서는 그대로 다시 내보내
// 서버 쪽 호출부가 두 곳을 import 하지 않게 한다.
export { PASSCODE_MAX, PASSCODE_MIN, generatePasscode, isValidPasscode } from './passcodeFormat.ts';

const VERSION = 'v1';
const IV_BYTES = 12;

/**
 * AUTH_SECRET에서 이 용도만의 열쇠를 뽑는다.
 * 다른 용도(업로드 티켓·잠금 쿠키)와 같은 비밀을 쓰지만 **열쇠는 갈라 둔다** —
 * 한 곳의 서명값이 다른 곳에서 그대로 통하면 안 된다.
 */
function keyFrom(secret: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', secret, 'ktdoc-resource-passcode', 'aes-256-gcm', 32)
  );
}

export function encryptPasscode(plain: string, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ct.toString('base64url'),
  ].join('.');
}

/**
 * 읽어 낸다. 읽히지 않으면 **null이고 던지지 않는다** — AUTH_SECRET이 바뀐
 * 배포에서 관리 화면 전체가 500으로 죽으면 안 된다. 화면은 null을 받아
 * "다시 설정해 주세요"로 드러낸다.
 */
export function decryptPasscode(enc: string, secret: string): string | null {
  if (typeof enc !== 'string') return null;
  const parts = enc.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const [, ivB64, tagB64, ctB64] = parts;
  if (!ivB64 || !tagB64 || !ctB64) return null;

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFrom(secret),
      Buffer.from(ivB64, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const out = Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64url')),
      decipher.final(),
    ]);
    return out.toString('utf8');
  } catch {
    // 태그 불일치(변조·다른 열쇠)도 여기로 온다 — 구분해서 알려 줄 이유가 없다
    return null;
  }
}

/** 입력이 저장된 비밀번호와 같은가. 길이가 달라도 던지지 않는다. */
export function passcodeMatches(enc: string, input: string, secret: string): boolean {
  const actual = decryptPasscode(enc, secret);
  if (actual === null || typeof input !== 'string') return false;
  const a = Buffer.from(actual, 'utf8');
  const b = Buffer.from(input, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
