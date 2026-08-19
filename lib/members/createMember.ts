/**
 * lib/members/createMember.ts — 회원 생성 한 곳
 *
 * 가입 경로가 둘이 되었다: 가입 페이지(/register)와 신청서 안에서의 가입.
 * 로직이 두 벌이 되면 한쪽만 고쳐지고, 그 한쪽이 보통 비밀번호나 약관 동의 쪽이다.
 * 그래서 만드는 일은 여기 하나로 모은다.
 *
 * **자녀 선행 가입을 강제할지가 두 경로의 유일한 차이다.**
 * 가입 페이지는 자녀를 찾지 못하면 막는다(오타를 잡아 준다).
 * 신청서 안에서는 막지 않는다 — 신규 가족은 아무도 가입돼 있지 않은 상태로
 * 신청서를 처음 만나기 때문이다. 그때는 student_guardians 에 student_id 를
 * 비운 채 이름만 남기고, 운영진이 승인하며 잇는다(스키마가 이미 그 모양이다).
 */

import { randomUUID } from 'node:crypto';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { notifyStaffOfRegistration } from '@/lib/push/system';
import { normalizeChildEntries, parseEnrollmentYear, type ChildEntry } from './childEntries';
import type { SignupRole } from '@/types/members';

// 입학년도 규칙은 childEntries 한 곳에 있다 — 기존 import 자리를 위해 재노출.
export { parseEnrollmentYear } from './childEntries';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;

export interface CreateMemberInput {
  role: SignupRole;
  email: string;
  password: string;
  name: string;
  phone?: string | null;
  /** 이용약관·개인정보처리방침 동의. false 면 만들지 않는다. */
  agreed: boolean;
  /** 원생 본인 가입일 때 */
  enrollmentYear?: number | null;
  /**
   * 학부모 가입일 때 — 자녀 목록(형제자매면 여러 명).
   * 자녀마다 student_guardians 행이 하나씩 만들어진다.
   */
  children?: { name: string; enrollmentYear?: number | string | null }[];
  /**
   * 자녀가 이미 가입돼 있어야 하는가.
   * 가입 페이지는 true(오타를 잡아 준다), 신청서 안 가입은 false(신규 가족을 막지 않는다).
   */
  requireExistingChild: boolean;
}

export type CreateMemberResult =
  | { ok: true; userId: string; status: 'pending' }
  | { ok: false; code: 'invalid'; message: string }
  | { ok: false; code: 'email_taken'; message: string }
  | { ok: false; code: 'child_not_found'; message: string };

export async function emailExists(email: string): Promise<boolean> {
  const rows = await query<{ id: string }[]>('SELECT id FROM users WHERE email = ?', [
    email.trim(),
  ]);
  return rows.length > 0;
}

/**
 * 회원을 만든다. 항상 **승인 대기(pending)** 로 만든다 — 누가 신청서를 냈다고
 * 바로 정회원이 되면 안 된다. 운영진이 확인하고 승인한다.
 */
export async function createMember(input: CreateMemberInput): Promise<CreateMemberResult> {
  const email = input.email?.trim() ?? '';
  const name = input.name?.trim() ?? '';
  const phone = input.phone?.trim() || null;

  if (!email || !input.password) {
    return { ok: false, code: 'invalid', message: '이메일과 비밀번호를 입력해주세요.' };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, code: 'invalid', message: '올바른 이메일 형식이 아닙니다.' };
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      code: 'invalid',
      message: `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
    };
  }
  if (!name) {
    return { ok: false, code: 'invalid', message: '이름을 입력해주세요.' };
  }
  if (input.agreed !== true) {
    return {
      ok: false,
      code: 'invalid',
      message: '이용약관과 개인정보처리방침에 동의해주세요.',
    };
  }

  let enrollmentYear: number | null = null;
  let children: ChildEntry[] = [];

  if (input.role === 'student') {
    enrollmentYear = parseEnrollmentYear(input.enrollmentYear);
    // 신청서 안 가입에서는 입학년도를 묻지 않는다(신청서가 곧 그해 등록이다).
    // 가입 페이지는 호출 전에 스스로 검증한다.
  } else {
    children = normalizeChildEntries(input.children);
    if (children.length === 0) {
      return { ok: false, code: 'invalid', message: '자녀(원생)의 이름을 입력해주세요.' };
    }
  }

  if (await emailExists(email)) {
    return { ok: false, code: 'email_taken', message: '이미 등록된 이메일입니다.' };
  }

  // 학부모: 자녀마다 찾기. 못 찾았을 때 막을지는 호출부가 정한다.
  const matchedByChild = new Map<ChildEntry, { id: string }[]>();
  for (const child of children) {
    const matched = child.enrollmentYear
      ? await query<{ id: string }[]>(
          `SELECT id FROM users WHERE role = 'student' AND name = ? AND enrollment_year = ?`,
          [child.name, child.enrollmentYear]
        )
      : await query<{ id: string }[]>(
          `SELECT id FROM users WHERE role = 'student' AND name = ?`,
          [child.name]
        );
    matchedByChild.set(child, matched);

    if (matched.length === 0 && input.requireExistingChild) {
      return {
        ok: false,
        code: 'child_not_found',
        message: `'${child.name}' 원생을 찾을 수 없습니다. 자녀(원생)가 먼저 회원가입했는지, 이름·입학년도가 정확한지 확인해주세요.`,
      };
    }
  }

  const passwordHash = await hashPassword(input.password);
  const newUserId = randomUUID();

  await query(
    `INSERT INTO users (id, email, password_hash, name, phone, role, status, enrollment_year, terms_agreed_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())`,
    [newUserId, email, passwordHash, name, phone, input.role, enrollmentYear]
  );

  if (input.role === 'parent') {
    // 자녀마다 연결 행 하나 — 형제자매면 여러 행이 생긴다.
    // 동명이인+같은 입학년도이거나 아직 자녀가 가입 전이면 student_id 를 비워 둔다.
    // 운영진이 승인하며 잇는다 — 이 우회로가 신규 가족을 막지 않는 장치다.
    for (const child of children) {
      const matched = matchedByChild.get(child) ?? [];
      const studentId = matched.length === 1 ? matched[0].id : null;
      await query(
        `INSERT INTO student_guardians
           (id, guardian_id, student_id, claimed_student_name, claimed_enrollment_year)
         VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), newUserId, studentId, child.name, child.enrollmentYear]
      );
    }
  }

  // 운영진 알림은 실패해도 가입 자체를 되돌리지 않는다.
  await notifyStaffOfRegistration({ id: newUserId, name, role: input.role }).catch((err) =>
    console.error('가입 알림 발송 실패:', err)
  );

  return { ok: true, userId: newUserId, status: 'pending' };
}
