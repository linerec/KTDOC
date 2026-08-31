/**
 * 운영진이 원생 계정을 대신 만든다.
 *
 * ## 왜 createMember와 갈라 두는가
 *
 * 두 가지가 다르고, 둘 다 거짓 기록을 남기지 않기 위해서다.
 *
 * 1. **약관 동의 시각을 남기지 않는다.** createMember는 `terms_agreed_at = NOW()`를
 *    박는데, 그건 "본인이 지금 동의했다"는 기록이다. 유치원생 대신 운영진이
 *    만드는 계정에 그 서명을 남기면 사실이 아닌 것이 남는다. NULL로 둔다 —
 *    이 값을 보고 무엇을 막는 코드는 없다(2026-08-31 확인).
 * 2. **처음부터 정회원(active)이다.** 스스로 가입한 것이 아니라 운영진이
 *    신청서를 보고 만든 계정이라, 다시 승인을 기다릴 이유가 없다.
 *
 * 비밀번호는 여기서 정하지 않는다. 부르는 쪽이 곧바로 임시 비밀번호를 발급하고
 * (setTempPassword) 그때 must_change_password가 켜진다 — 첫 로그인에서 새 비밀번호를
 * 정하게 하는 것이 이 계정을 넘겨주는 방식이다.
 */

import { randomUUID } from 'node:crypto';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/password';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateStudentInput {
  name: string;
  email: string;
  /** 입학년도. 모르면 null */
  enrollmentYear?: number | null;
  phone?: string | null;
}

export type CreateStudentResult =
  | { ok: true; userId: string }
  | { ok: false; code: 'invalid' | 'email_taken'; message: string };

export async function createStudentByStaff(
  input: CreateStudentInput
): Promise<CreateStudentResult> {
  const name = (input.name ?? '').trim();
  const email = (input.email ?? '').trim().toLowerCase();

  if (!name) return { ok: false, code: 'invalid', message: '원생 이름을 입력해주세요.' };
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, code: 'invalid', message: '이메일 주소를 확인해주세요.' };
  }

  const taken = await query<{ id: string }[]>('SELECT id FROM users WHERE email = ?', [email]);
  if (taken.length > 0) {
    return { ok: false, code: 'email_taken', message: '이미 쓰이고 있는 이메일입니다.' };
  }

  const userId = randomUUID();
  // 로그인할 수 없는 무작위 값으로 시작한다. 부르는 쪽이 곧바로 임시 비밀번호를
  // 덮어쓰지만, 그 사이에 열려 있는 순간을 만들지 않는다.
  const placeholder = await hashPassword(randomUUID());

  await query(
    `INSERT INTO users
       (id, email, password_hash, name, phone, role, status, enrollment_year, terms_agreed_at)
     VALUES (?, ?, ?, ?, ?, 'student', 'active', ?, NULL)`,
    [userId, email, placeholder, name, input.phone?.trim() || null, input.enrollmentYear ?? null]
  );

  return { ok: true, userId };
}
